/**
 * topics.js
 * ---------------------------------------------------------------------------
 * Coração da tela "Revisões": cada tema, seu histórico de notas, prazos de
 * repetição espaçada, e a renderização da lista e da barra lateral (painel
 * de status + prioridades — a lista de categorias mora em categories.js).
 * ---------------------------------------------------------------------------
 */
import { state } from './state.js';
import { PRIO_LABEL, PRIO_ORDER, STATUS_TITLES, MASTERY_PERFECT_SCORES_REQUIRED } from './config.js';
import { todayISO, addDays, fmtDate, intervalForScore, escapeHtml, icon, randomId, stripHtml } from './utils.js';
import { el, setText, setHtml } from './dom.js';
import { openOverlay, closeOverlay } from './modal.js';
import { persistAll } from './firebase-sync.js';
import { populateCategorySelect, renderCategoryNav, colorForCategory } from './categories.js';
import { showToast } from './toast.js';

/* ---------------------------------------------------------------------------
   Regras de negócio (status de um tema, maestria, etc.)
--------------------------------------------------------------------------- */

export function countPerfectScores(topic){
  return (topic.history || []).filter(h => h.score >= 100).length;
}

export function isMastered(topic){
  return countPerfectScores(topic) >= MASTERY_PERFECT_SCORES_REQUIRED;
}

export function statusOf(topic){
  if(isMastered(topic)) return 'dominado';
  const today = todayISO();
  if(!topic.history || topic.history.length === 0) return 'hoje';
  if(topic.nextDate < today) return 'atrasado';
  if(topic.nextDate === today) return 'hoje';
  return 'emdia';
}

/* ---------------------------------------------------------------------------
   Modal: criar / editar tema
--------------------------------------------------------------------------- */

export function openTopicModal(topicId){
  state.editingTopicId = topicId || null;
  const topic = topicId ? state.topics.find(t => t.id === topicId) : null;

  setText('modal-title', topic ? 'Editar tema' : 'Novo tema');
  const saveBtn = el('save-topic-btn');
  if(saveBtn) saveBtn.textContent = topic ? 'Salvar alterações' : 'Salvar';

  const nameInput = el('f-name');
  if(nameInput) nameInput.value = topic ? topic.name : '';

  populateCategorySelect();
  const catSelect = el('f-cat');
  if(catSelect) catSelect.value = topic ? (topic.cat || '') : '';

  const prioSelect = el('f-prio');
  if(prioSelect) prioSelect.value = topic ? (topic.prio || 'alta') : 'alta';

  const dateInput = el('f-next-date');
  if(dateInput) dateInput.value = topic ? topic.nextDate : todayISO();

  openOverlay('overlay');
  setTimeout(() => nameInput && nameInput.focus(), 50);
}

export function closeTopicModal(){
  closeOverlay('overlay');
  state.editingTopicId = null;
}

export async function saveTopic(){
  const nameInput = el('f-name');
  const catSelect = el('f-cat');
  const prioSelect = el('f-prio');
  const dateInput = el('f-next-date');
  if(!nameInput || !catSelect || !prioSelect) return;

  const name = nameInput.value.trim();
  if(!name) return;
  const cat = catSelect.value;
  const prio = prioSelect.value;
  const nextDate = (dateInput && dateInput.value) ? dateInput.value : todayISO();

  if(state.editingTopicId){
    const topic = state.topics.find(t => t.id === state.editingTopicId);
    if(topic){ topic.name = name; topic.cat = cat; topic.prio = prio; topic.nextDate = nextDate; }
  } else {
    state.topics.push({
      id: randomId('t'),
      name, cat, prio,
      history: [],
      notes: '',
      nextDate,
      createdAt: todayISO()
    });
  }

  closeTopicModal();
  await persistAll();
}

export async function deleteTopic(topicId){
  const topic = state.topics.find(t => t.id === topicId);
  if(!topic) return;
  const confirmed = confirm(`Excluir o tema "${topic.name}"? Todo o histórico de revisões dele será perdido.`);
  if(!confirmed) return;

  state.topics = state.topics.filter(t => t.id !== topicId);
  await persistAll();
}

/* ---------------------------------------------------------------------------
   Modal: registrar revisão
--------------------------------------------------------------------------- */

export function openReviewModal(topicId){
  const topic = state.topics.find(t => t.id === topicId);
  if(!topic) return;

  state.reviewTargetId = topicId;
  setText('review-topic-name', topic.name);
  const scoreInput = el('f-score');
  if(scoreInput) scoreInput.value = '';

  openOverlay('review-overlay');
  setTimeout(() => scoreInput && scoreInput.focus(), 50);
}

export function closeReviewModal(){
  closeOverlay('review-overlay');
  state.reviewTargetId = null;
}

export async function submitReview(){
  const topic = state.topics.find(t => t.id === state.reviewTargetId);
  if(!topic) return;

  const scoreInput = el('f-score');
  if(!scoreInput) return;
  const rawValue = scoreInput.value;
  const score = Number(rawValue);

  const isValid = rawValue !== '' && !Number.isNaN(score) && score >= 0 && score <= 100;
  if(!isValid){
    scoreInput.style.borderColor = 'var(--brick)';
    scoreInput.focus();
    showToast('Digite uma nota entre 0 e 100.', 'error');
    return;
  }

  topic.history = topic.history || [];
  topic.history.push({ date: todayISO(), score });
  topic.nextDate = addDays(todayISO(), intervalForScore(score));

  closeReviewModal();
  await persistAll();
}

/* ---------------------------------------------------------------------------
   Filtros da tela de Revisões
--------------------------------------------------------------------------- */

export function setStatusFilter(filter){
  state.currentFilter = filter;
  renderTopics();
  renderRevisoesSidebar();
}
export function setCategoryFilter(categoryName){
  state.currentCatFilter = (state.currentCatFilter === categoryName) ? null : categoryName;
  renderTopics();
  renderRevisoesSidebar();
}
export function setPriorityFilter(priority){
  state.currentPrioFilter = (state.currentPrioFilter === priority) ? 'todas' : priority;
  renderTopics();
  renderRevisoesSidebar();
}

/* ---------------------------------------------------------------------------
   Renderização
--------------------------------------------------------------------------- */

function renderStatusNav(){
  const counts = { todos: state.topics.length, hoje: 0, atrasado: 0, emdia: 0, dominado: 0 };
  state.topics.forEach(t => counts[statusOf(t)]++);

  const labels = { todos: 'Todos', hoje: 'Hoje', atrasado: 'Atrasados', emdia: 'Em dia', dominado: 'Dominados' };

  setHtml('status-nav', ['todos', 'hoje', 'atrasado', 'emdia', 'dominado'].map(key => `
    <button class="nav-item ${state.currentFilter === key ? 'active' : ''}" onclick="setStatusFilter('${key}')">
      ${icon(key)}<span class="nav-label">${labels[key]}</span><span class="nav-count">${counts[key]}</span>
    </button>
  `).join(''));
}

function renderPriorityNav(){
  const counts = { altissima: 0, alta: 0, media: 0, baixa: 0 };
  state.topics.forEach(t => { const p = t.prio || 'alta'; counts[p] = (counts[p] || 0) + 1; });

  setHtml('prio-nav', PRIO_ORDER.map(p => `
    <button class="nav-item ${state.currentPrioFilter === p ? 'active' : ''}" onclick="setPriorityFilter('${p}')">
      <span class="prio-swatch" style="background:var(--prio-${p})"></span>
      <span class="nav-label">${PRIO_LABEL[p].replace(' incidência', '')}</span>
      <span class="nav-count">${counts[p]}</span>
    </button>
  `).join(''));
}

export function renderRevisoesSidebar(){
  renderStatusNav();
  renderCategoryNav();
  renderPriorityNav();
}

function topicMetaHtml(topic, status){
  const history = topic.history || [];
  const lastScore = history.length ? history[history.length - 1].score : null;
  const perfectCount = countPerfectScores(topic);

  if(status === 'dominado'){
    return `<span class="status-word dominado">Dominado</span><span>${history.length} revisões concluídas</span><span>2 notas de 100% atingidas</span>`;
  }
  if(!history.length){
    return `<span class="status-word hoje">Hoje</span><span>primeira revisão pendente</span>`;
  }
  if(status === 'atrasado'){
    return `<span class="status-word atrasado">Atrasado</span><span>previsto para ${fmtDate(topic.nextDate)}</span><span>última nota ${lastScore}%</span>`;
  }
  if(status === 'hoje'){
    return `<span class="status-word hoje">Hoje</span><span>${history.length} revisões concluídas</span><span>última nota ${lastScore}%</span>`;
  }
  const masteryHint = perfectCount === 1 ? '<span>1 de 2 notas de 100% para dominar</span>' : '';
  return `<span class="status-word emdia">Em dia</span><span>próxima em ${fmtDate(topic.nextDate)}</span><span>última nota ${lastScore}%</span>${masteryHint}`;
}

function topicRowHtml(topic){
  const status = statusOf(topic);
  const history = topic.history || [];
  const mastered = isMastered(topic);

  const dots = history.map(h => {
    const dotClass = mastered ? 'dominado-dot' : (h.score < 50 ? 'low-score' : '');
    return `<span class="dot ${dotClass}" title="${h.score}%">✓</span>`;
  }).join('');

  const action = status === 'dominado'
    ? `<span class="done-check">${icon('emdia')} Concluído</span>`
    : `<button class="btn-review ${status === 'atrasado' ? 'urgent' : ''}" onclick="openReviewModal('${topic.id}')">Revisar</button>`;

  const hasNotes = !!stripHtml(topic.notes).trim();
  const categoryTag = topic.cat
    ? `<span class="tag"><span class="tag-dot" style="background:${colorForCategory(topic.cat)}"></span>${escapeHtml(topic.cat)}</span>`
    : '';

  return `
    <div class="row" draggable="true" data-id="${topic.id}"
         ondragstart="onDragStart(event,'${topic.id}','topics')"
         ondragend="onDragEnd(event)"
         ondragover="onDragOver(event)"
         ondrop="handleDrop(event,'${topic.id}','topics')">
      <span class="drag-handle" title="Arrastar para reordenar"><span></span><span></span><span></span><span></span><span></span><span></span></span>
      <div class="accent ${status}"></div>
      <div class="row-main">
        <div class="row-top">
          <span class="prio ${topic.prio || 'alta'}"><span class="prio-dot"></span>${PRIO_LABEL[topic.prio || 'alta']}</span>
          <span class="row-name">${escapeHtml(topic.name)}</span>
          ${categoryTag}
        </div>
        <div class="row-meta">${topicMetaHtml(topic, status)}</div>
      </div>
      <div class="dots">${dots}</div>
      <div class="row-actions">
        ${action}
        <button class="btn-del btn-notes ${hasNotes ? 'has-notes' : ''}" onclick="openNotesModal('${topic.id}')" title="${hasNotes ? 'Ver/editar anotações' : 'Adicionar anotação'}">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v5a1 1 0 0 0 1 1h5"></path><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"></path><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="13" y2="17"></line></svg>
        </button>
        <button class="btn-del" onclick="openTopicModal('${topic.id}')" title="Editar">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
        </button>
        <button class="btn-del" onclick="deleteTopic('${topic.id}')" title="Excluir">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>
  `;
}

export function renderTopics(){
  const searchInput = el('search');
  const search = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const filtered = state.topics.filter(topic => {
    if(state.currentFilter !== 'todos' && statusOf(topic) !== state.currentFilter) return false;
    if(state.currentPrioFilter !== 'todas' && (topic.prio || 'alta') !== state.currentPrioFilter) return false;
    if(state.currentCatFilter && topic.cat !== state.currentCatFilter) return false;
    if(search && !(topic.name.toLowerCase().includes(search) || (topic.cat || '').toLowerCase().includes(search))) return false;
    return true;
  });

  setText('main-title', STATUS_TITLES[state.currentFilter]);

  const extras = [];
  if(state.currentCatFilter) extras.push(`categoria ${state.currentCatFilter}`);
  if(state.currentPrioFilter !== 'todas') extras.push(`prioridade ${PRIO_LABEL[state.currentPrioFilter].toLowerCase()}`);
  let subtitle = filtered.length === 1 ? '1 tema nesta visão' : `${filtered.length} temas nesta visão`;
  if(extras.length) subtitle += `, filtrando por ${extras.join(' e ')}`;
  subtitle += '.';
  setText('main-subtitle', subtitle);

  if(filtered.length === 0){
    const message = state.topics.length === 0
      ? 'Adicione seu primeiro tema para começar a organizar suas revisões.'
      : 'Nenhum tema corresponde a esse filtro.';
    setHtml('list', `<div class="empty"><strong>Nada por aqui</strong>${message}</div>`);
    return;
  }

  setHtml('list', filtered.map(topicRowHtml).join(''));
}
