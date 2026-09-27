/**
 * flashcards.js
 * ---------------------------------------------------------------------------
 * Flashcards simples: frente/verso, organizados por categoria. No modo de
 * estudo, você vê a frente, toca para virar e vê o verso, e diz se lembrou
 * ou não — sem múltipla escolha, sem correção automática, só repetição
 * ativa mesmo, do jeito mais rápido de usar no dia a dia.
 * ---------------------------------------------------------------------------
 */
import { state } from './state.js';
import { CAT_PALETTE, FSRS_DECAY, FSRS_FACTOR } from './config.js';
import { escapeHtml, randomId, todayISO, addDays, daysBetween, fmtDate } from './utils.js';
import { el, setText, setHtml, setDisplay } from './dom.js';
import { openOverlay, closeOverlay } from './modal.js';
import { persistAll } from './firebase-sync.js';
import { populateCategorySelectInto, renderCategoryNavGeneric, colorForCategory } from './categories.js';
import { showToast } from './toast.js';

/* ---------------------------------------------------------------------------
   Banco de flashcards: criar / editar / excluir
--------------------------------------------------------------------------- */

export function openFlashcardModal(cardId){
  state.editingFlashcardId = cardId || null;
  const card = cardId ? state.flashcards.find(c => c.id === cardId) : null;

  setText('flashcard-modal-title', card ? 'Editar flashcard' : 'Novo flashcard');
  const saveBtn = el('save-flashcard-btn');
  if(saveBtn) saveBtn.textContent = card ? 'Salvar alterações' : 'Salvar';

  const frontInput = el('f-flashcard-front');
  const backInput = el('f-flashcard-back');
  if(frontInput) frontInput.value = card ? card.front : '';
  if(backInput) backInput.value = card ? card.back : '';

  populateCategorySelectInto('f-flashcard-cat');
  const catSelect = el('f-flashcard-cat');
  if(catSelect) catSelect.value = card ? (card.cat || '') : '';

  // os campos de ajuste manual do FSRS só fazem sentido pra um cartão que já
  // foi revisado ao menos uma vez (tem estabilidade/dificuldade reais).
  const showFsrsFields = !!(card && card.status === 'review');
  setDisplay('fsrs-manual-fields', showFsrsFields);
  if(showFsrsFields){
    const dueInput = el('f-flashcard-due');
    const stabilityInput = el('f-flashcard-stability');
    const difficultyInput = el('f-flashcard-difficulty');
    if(dueInput) dueInput.value = card.due;
    if(stabilityInput) stabilityInput.value = Number(card.stability || 0).toFixed(1);
    if(difficultyInput) difficultyInput.value = Number(card.difficulty || 5).toFixed(1);
  }

  openOverlay('flashcard-overlay');
  setTimeout(() => frontInput && frontInput.focus(), 50);
}

export function closeFlashcardModal(){
  closeOverlay('flashcard-overlay');
  state.editingFlashcardId = null;
}

export async function saveFlashcard(){
  const frontInput = el('f-flashcard-front');
  const backInput = el('f-flashcard-back');
  const catSelect = el('f-flashcard-cat');
  if(!frontInput || !backInput) return;

  const front = frontInput.value.trim();
  const back = backInput.value.trim();
  if(!front || !back){
    if(!front) frontInput.style.borderColor = 'var(--brick)';
    if(!back) backInput.style.borderColor = 'var(--brick)';
    showToast('Preencha a frente e o verso do cartão.', 'error');
    return;
  }
  const cat = catSelect ? catSelect.value : '';

  if(state.editingFlashcardId){
    const card = state.flashcards.find(c => c.id === state.editingFlashcardId);
    if(card){
      card.front = front; card.back = back; card.cat = cat;

      if(card.status === 'review'){
        const dueInput = el('f-flashcard-due');
        const stabilityInput = el('f-flashcard-stability');
        const difficultyInput = el('f-flashcard-difficulty');

        if(dueInput && dueInput.value) card.due = dueInput.value;

        if(stabilityInput && stabilityInput.value !== ''){
          const stability = Number(stabilityInput.value);
          if(!Number.isNaN(stability) && stability > 0){
            card.stability = stability;
          } else {
            stabilityInput.style.borderColor = 'var(--brick)';
            showToast('Estabilidade precisa ser um número maior que 0.', 'error');
            return;
          }
        }

        if(difficultyInput && difficultyInput.value !== ''){
          const difficulty = Number(difficultyInput.value);
          if(!Number.isNaN(difficulty) && difficulty >= 1 && difficulty <= 10){
            card.difficulty = difficulty;
          } else {
            difficultyInput.style.borderColor = 'var(--brick)';
            showToast('Dificuldade precisa ser um número entre 1 e 10.', 'error');
            return;
          }
        }
      }
    }
  } else {
    state.flashcards.push({
      id: randomId('f'),
      front, back, cat,
      status: 'new', interval: 0, lapses: 0, due: todayISO(),
      createdAt: new Date().toISOString().slice(0, 10)
    });
  }

  closeFlashcardModal();
  await persistAll();
  renderFlashcardsView();
}

export async function deleteFlashcard(cardId){
  const index = state.flashcards.findIndex(c => c.id === cardId);
  if(index === -1) return;
  const card = state.flashcards[index];
  const confirmed = confirm('Excluir este flashcard? Essa ação não pode ser desfeita.');
  if(!confirmed) return;

  state.flashcards.splice(index, 1);
  await persistAll();
  renderFlashcardsView();

  showToast('Flashcard excluído.', 'info', {
    actionLabel: 'Desfazer',
    onAction: async () => {
      state.flashcards.splice(index, 0, card);
      await persistAll();
      renderFlashcardsView();
    }
  });
}

export function setFlashcardsCatFilter(categoryName){
  state.flashcardsCatFilter = (state.flashcardsCatFilter === categoryName) ? null : categoryName;
  renderFlashcardsView();
}

export async function deleteFlashcardsInCategory(categoryName){
  const removed = state.flashcards.filter(c => c.cat === categoryName);
  if(removed.length === 0) return;
  const confirmed = confirm(`Excluir os ${removed.length} flashcards da categoria "${categoryName}"? Essa ação não pode ser desfeita.`);
  if(!confirmed) return;

  state.flashcards = state.flashcards.filter(c => c.cat !== categoryName);
  await persistAll();
  renderFlashcardsView();

  showToast(`${removed.length} flashcards excluídos.`, 'success', {
    actionLabel: 'Desfazer',
    onAction: async () => {
      state.flashcards.push(...removed);
      await persistAll();
      renderFlashcardsView();
    }
  });
}

/* ---------------------------------------------------------------------------
   Atividade diária: quantas revisões feitas hoje, tempo gasto e sequência de
   dias seguidos estudando — tudo o que a aba de Análise mostra além do
   gráfico de distribuição.
--------------------------------------------------------------------------- */

// zera os contadores do dia sempre que a data muda (sem precisar de um timer
// rodando em segundo plano — só confere toda vez que algo é acessado/gravado)
function ensureDailyStatsFresh(){
  const today = todayISO();
  if(state.dailyStats.date !== today){
    state.dailyStats = { date: today, reviewed: 0, studySeconds: 0 };
  }
}

function updateStreakOnActivity(){
  const today = todayISO();
  if(state.streak.lastDate === today) return; // já contou hoje
  const yesterday = addDays(today, -1);
  state.streak.count = (state.streak.lastDate === yesterday) ? state.streak.count + 1 : 1;
  state.streak.lastDate = today;
}

let studySessionLastTick = null;

/* ---------------------------------------------------------------------------
   FSRS (Free Spaced Repetition Scheduler): modelo de memória com três peças —
   Dificuldade (D, 1 a 10), Estabilidade (S, em dias) e Retrievabilidade (R,
   a chance estimada de você lembrar HOJE, calculada a partir de quanto tempo
   se passou desde a última revisão e da estabilidade atual).

   O "intervalo" de revisão não é mais um número fixo multiplicado por um
   fator de facilidade (jeito do SM-2/Anki clássico) — ele é derivado
   matematicamente da estabilidade, perguntando "em quantos dias a
   retrievabilidade cai para 90%?".
--------------------------------------------------------------------------- */
// pesos vêm do estado (ajustáveis na tela de Configurações), não fixos
function w(){ return state.settings.fsrsWeights; }

// Probabilidade estimada de lembrar após `elapsedDays` dias, dado que a
// estabilidade atual é `stability`. Por definição, R(t=stability) = 0.9.
function retrievability(elapsedDays, stability){
  if(elapsedDays <= 0) return 1;
  return Math.pow(1 + FSRS_FACTOR * elapsedDays / stability, FSRS_DECAY);
}

// Quantos dias até a retrievabilidade cair para o alvo desejado (padrão 90%).
function nextInterval(stability){
  const retention = state.settings.fsrsRetention;
  const days = (stability / FSRS_FACTOR) * (Math.pow(retention, 1 / FSRS_DECAY) - 1);
  return Math.max(1, Math.round(days));
}

function clampDifficulty(d){
  return Math.min(10, Math.max(1, d));
}

// Primeira vez que um cartão é respondido de verdade (graduando de "novo"
// para "em revisão"): estabilidade e dificuldade partem dos pesos treinados
// para cada nota, sem histórico prévio de retrievabilidade.
function initStability(ratingNum){
  return Math.max(0.1, w()[ratingNum - 1]);
}
function initDifficulty(ratingNum){
  return clampDifficulty(w()[4] - Math.exp(w()[5] * (ratingNum - 1)) + 1);
}

// Dificuldade muda um pouco a cada revisão (fica mais fácil/difícil conforme
// a nota dada), mas sempre puxando de volta em direção à dificuldade "base"
// de quem sempre acerta fácil — evita que um cartão fique preso numa
// dificuldade extrema por causa de um único erro isolado.
function updateDifficulty(prevDifficulty, ratingNum){
  const easyAnchor = initDifficulty(4);
  const shifted = prevDifficulty - w()[6] * (ratingNum - 3);
  const reverted = w()[7] * easyAnchor + (1 - w()[7]) * shifted;
  return clampDifficulty(reverted);
}

// Acertou (Difícil/Bom/Fácil): a estabilidade cresce mais quanto mais tempo
// já tinha se passado (mais surpreendente lembrar = mais reforço), e menos
// para cartões já fáceis/estáveis. "Difícil" cresce menos, "Fácil" cresce mais.
function stabilityAfterSuccess(difficulty, stability, r, ratingNum){
  const hardPenalty = ratingNum === 2 ? w()[15] : 1;
  const easyBonus = ratingNum === 4 ? w()[16] : 1;
  const growth = Math.exp(w()[8])
    * (11 - difficulty)
    * Math.pow(stability, -w()[9])
    * (Math.exp((1 - r) * w()[10]) - 1)
    * hardPenalty
    * easyBonus;
  return stability * (1 + growth);
}

// Errou (Errei): a estabilidade despenca — quanto mais difícil o cartão e
// quanto mais tempo tinha se passado (surpresa maior), maior a queda.
function stabilityAfterLapse(difficulty, stability, r){
  return w()[11] * Math.pow(difficulty, -w()[12]) * (Math.pow(stability + 1, w()[13]) - 1) * Math.exp((1 - r) * w()[14]);
}

/**
 * Dado um cartão e a nota escolhida (again/hard/good/easy), calcula o
 * próximo estado sem alterar nada ainda — devolve o que mudaria, para poder
 * tanto aplicar de verdade quanto só mostrar uma prévia ("em 3 dias") nos
 * botões antes de responder.
 *
 * Cartões "novos" que recebem Errei/Difícil voltam pro final da fila da
 * MESMA sessão de estudo (simplificação dos "passos de aprendizagem" do
 * Anki, adequada a um app sem lembretes em segundo plano). Só saem da fila
 * quando respondidos com Bom ou Fácil — essa é a nota que o FSRS usa para
 * calcular a primeira estabilidade e dificuldade reais do cartão.
 */
export function computeSchedule(card, rating){
  const today = todayISO();
  const ratingNum = { again: 1, hard: 2, good: 3, easy: 4 }[rating];

  // migração automática: cartões criados antes do FSRS (sem estabilidade
  // registrada, mas já em revisão) ganham uma estimativa inicial razoável a
  // partir do intervalo que já tinham, e passam a evoluir pelo FSRS dali.
  if(card.status === 'review' && (card.stability === undefined || card.stability === null)){
    card.stability = Math.max(1, card.interval || 1);
    card.difficulty = 5;
    card.lastReview = card.lastReview || today;
  }

  if(card.status !== 'review'){
    if(rating === 'again' || rating === 'hard'){
      return { requeue: true, patch: {} };
    }
    const stability = initStability(ratingNum);
    const difficulty = initDifficulty(ratingNum);
    const interval = nextInterval(stability);
    return { requeue: false, patch: {
      status: 'review', stability, difficulty, interval,
      due: addDays(today, interval), lastReview: today
    }};
  }

  const elapsed = Math.max(0, daysBetween(card.lastReview || today, today));
  const r = retrievability(elapsed, card.stability);
  const newDifficulty = updateDifficulty(card.difficulty, ratingNum);

  let newStability;
  const extra = {};
  if(rating === 'again'){
    newStability = stabilityAfterLapse(newDifficulty, card.stability, r);
    extra.lapses = (card.lapses || 0) + 1;
  } else {
    newStability = stabilityAfterSuccess(newDifficulty, card.stability, r, ratingNum);
  }

  const interval = nextInterval(newStability);
  return { requeue: false, patch: {
    stability: newStability, difficulty: newDifficulty, interval,
    due: addDays(today, interval), lastReview: today, ...extra
  }};
}

// Texto curto tipo "amanhã" / "3d" / "1 mês" mostrado embaixo de cada botão,
// igual o Anki faz, pra você saber o efeito de cada resposta antes de escolher.
function previewLabel(card, rating){
  const result = computeSchedule(card, rating);
  if(result.requeue) return 'agora mesmo';
  const days = result.patch.interval;
  if(days < 1) return 'hoje';
  if(days === 1) return 'amanhã';
  if(days < 30) return `${days}d`;
  if(days < 365) return `${Math.round(days / 30)} mês${Math.round(days / 30) > 1 ? 'es' : ''}`;
  return `${Math.round(days / 365)} ano${Math.round(days / 365) > 1 ? 's' : ''}`;
}

function cardStudyState(card){
  if(card.status !== 'review') return { key: 'novo', label: 'Novo' };
  const today = todayISO();
  if(card.due < today) return { key: 'atrasado', label: 'Atrasado' };
  if(card.due === today) return { key: 'hoje', label: 'Para hoje' };
  return { key: 'emdia', label: `Revisar em ${fmtDate(card.due)}` };
}


/* ---------------------------------------------------------------------------
   Renderização: barra lateral + banco de cartões
--------------------------------------------------------------------------- */

export function renderFlashcardsSidebar(){
  renderCategoryNavGeneric({
    navId: 'flashcard-cat-nav',
    items: state.flashcards,
    activeFilter: state.flashcardsCatFilter,
    onFilterFn: 'setFlashcardsCatFilter'
  });
}

function filteredFlashcards(){
  const searchInput = el('flashcard-search');
  const search = searchInput ? searchInput.value.trim().toLowerCase() : '';
  return state.flashcards.filter(c => {
    if(state.flashcardsCatFilter && c.cat !== state.flashcardsCatFilter) return false;
    if(search && !c.front.toLowerCase().includes(search) && !c.back.toLowerCase().includes(search)) return false;
    return true;
  });
}

function flashcardRowHtml(card){
  const catTag = card.cat
    ? `<span class="tag"><span class="tag-dot" style="background:${colorForCategory(card.cat)}"></span>${escapeHtml(card.cat)}</span>`
    : '';
  const studyState = cardStudyState(card);
  return `
    <div class="row flashcard-card">
      <div class="accent ${studyState.key}"></div>
      <div class="row-main">
        <div class="row-top">${catTag}<span class="status-word ${studyState.key}">${studyState.label}</span></div>
        <p class="flashcard-front-preview">${escapeHtml(card.front)}</p>
        <p class="flashcard-back-preview">${escapeHtml(card.back)}</p>
      </div>
      <div class="row-actions">
        <button class="btn-del" onclick="openFlashcardModal('${card.id}')" title="Editar">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
        </button>
        <button class="btn-del" onclick="deleteFlashcard('${card.id}')" title="Excluir">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>
  `;
}

function renderFlashcardsBank(){
  const filtered = filteredFlashcards();
  setText('flashcards-subtitle', filtered.length === 1 ? '1 flashcard' : `${filtered.length} flashcards`);

  const today = todayISO();
  const newCount = filtered.filter(c => c.status !== 'review').length;
  const dueCount = filtered.filter(c => c.status === 'review' && c.due <= today).length;
  setHtml('flashcards-stats', `
    <span class="nav-count-badge novo">${newCount} novo${newCount === 1 ? '' : 's'}</span>
    <span class="nav-count-badge hoje">${dueCount} para hoje</span>
  `);

  if(state.flashcardsCatFilter){
    const catCount = state.flashcards.filter(c => c.cat === state.flashcardsCatFilter).length;
    setHtml('flashcards-bulk-delete', `
      <button class="side-link" style="color:var(--brick);" onclick="deleteFlashcardsInCategory('${escapeHtml(state.flashcardsCatFilter)}')">
        Excluir todos os ${catCount} flashcards de "${escapeHtml(state.flashcardsCatFilter)}"
      </button>
    `);
  } else {
    setHtml('flashcards-bulk-delete', '');
  }

  if(filtered.length === 0){
    const message = state.flashcards.length === 0
      ? 'Adicione seu primeiro flashcard para começar a estudar por aqui mesmo.'
      : 'Nenhum flashcard corresponde a esse filtro.';
    setHtml('flashcards-bank-list', `<div class="empty"><strong>Nada por aqui</strong>${message}</div>`);
    return;
  }
  setHtml('flashcards-bank-list', filtered.map(flashcardRowHtml).join(''));
}

export function showFlashcardsAnalytics(){
  state.flashcardsSubView = 'analytics';
  renderFlashcardsView();
}
export function hideFlashcardsAnalytics(){
  state.flashcardsSubView = 'bank';
  renderFlashcardsView();
}

export function renderFlashcardsView(){
  renderFlashcardsSidebar();

  const view = state.studying ? 'study' : state.flashcardsSubView;
  setDisplay('flashcards-bank-view', view === 'bank');
  setDisplay('flashcards-study-view', view === 'study');
  setDisplay('flashcards-analytics-view', view === 'analytics');

  if(view === 'study') renderStudyCard();
  else if(view === 'analytics') renderFlashcardsAnalytics();
  else renderFlashcardsBank();
}

function formatDuration(totalSeconds){
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = n => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function renderFlashcardsAnalytics(){
  ensureDailyStatsFresh();
  const stats = state.flashcardStats;
  const total = (stats.again || 0) + (stats.hard || 0) + (stats.good || 0) + (stats.easy || 0);

  // --- gráfico de distribuição por marcação ---
  const segments = [
    { key: 'easy', label: 'Fácil', color: 'var(--teal)', count: stats.easy || 0 },
    { key: 'good', label: 'Bom', color: 'var(--sage)', count: stats.good || 0 },
    { key: 'hard', label: 'Difícil', color: 'var(--gold)', count: stats.hard || 0 },
    { key: 'again', label: 'Errei', color: 'var(--brick)', count: stats.again || 0 }
  ];

  let gradientStops = [];
  let cursor = 0;
  segments.forEach(seg => {
    const pct = total ? (seg.count / total) * 100 : 0;
    gradientStops.push(`${seg.color} ${cursor}% ${cursor + pct}%`);
    cursor += pct;
  });
  const donutBackground = total
    ? `conic-gradient(${gradientStops.join(', ')})`
    : 'var(--field-bg)';

  const legendRows = segments.map(seg => {
    const pct = total ? ((seg.count / total) * 100).toFixed(1) : '0.0';
    return `
      <div class="analytics-legend-row">
        <span class="analytics-legend-dot" style="background:${seg.color}"></span>
        <span class="analytics-legend-label">${seg.label}</span>
        <span class="analytics-legend-count">${seg.count}</span>
        <span class="analytics-legend-pct">${pct}%</span>
      </div>
    `;
  }).join('');

  // --- resumo do dia: revisar hoje, tempo de estudo, sequência ---
  const goal = state.settings.dailyGoal;
  const reviewedToday = state.dailyStats.reviewed || 0;
  const donePct = Math.min(100, Math.round((reviewedToday / goal) * 100));
  const ringBackground = `conic-gradient(var(--sage) 0% ${donePct}%, var(--field-bg) ${donePct}% 100%)`;

  setHtml('flashcards-analytics-body', `
    <div class="analytics-section">
      <h2 class="analytics-title">Resumo de hoje</h2>
      <div class="analytics-today">
        <div class="ring-chart" style="background:${ringBackground}">
          <div class="ring-chart-hole">
            <strong>${donePct}%</strong>
            <span>Concluído</span>
          </div>
        </div>
        <div class="analytics-today-stats">
          <div class="today-stat">
            <strong>${reviewedToday}/${goal}</strong>
            <span>Revisar hoje</span>
          </div>
          <div class="today-stat">
            <strong>${formatDuration(state.dailyStats.studySeconds || 0)}</strong>
            <span>Tempo de estudo</span>
          </div>
          <div class="today-stat">
            <strong>${state.streak.count || 0}d</strong>
            <span>Sequência</span>
          </div>
        </div>
      </div>
      <button class="btn-primary" style="width:100%;padding:12px;margin-top:16px;" onclick="startStudy()">Revisar agora</button>
    </div>

    <div class="analytics-section">
      <h2 class="analytics-title">Distribuição dos flashcards</h2>
      <p class="subtitle" style="margin-bottom:16px;">Cards revisados por marcação, desde sempre</p>
      <div class="analytics-distribution">
        <div class="donut-chart" style="background:${donutBackground}">
          <div class="donut-chart-hole">
            <span>Total</span>
            <strong>${total}</strong>
          </div>
        </div>
        <div class="analytics-legend">
          ${total ? legendRows : '<p style="color:var(--text-muted);font-size:13px;">Ainda sem revisões registradas. Estude alguns cartões para ver os números aqui.</p>'}
        </div>
      </div>
    </div>
  `);
}

/* ---------------------------------------------------------------------------
   Modo de estudo: vira o cartão, marca lembrei/não lembrei, avança
--------------------------------------------------------------------------- */

function shuffle(array){
  const copy = [...array];
  for(let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function startStudy(){
  const today = todayISO();
  const pool = filteredFlashcards().filter(c => c.status !== 'review' || c.due <= today);
  if(pool.length === 0){
    showToast('Nenhum flashcard novo ou pendente para estudar com esse filtro. 🎉', 'info');
    return;
  }
  state.studyPool = shuffle(pool);
  state.studyIndex = 0;
  state.studyScore = { again: 0, hard: 0, good: 0, easy: 0 };
  state.studyFlipped = false;
  state.studying = true;
  studySessionLastTick = Date.now();
  renderFlashcardsView();
}

export function exitStudy(){
  state.studying = false;
  renderFlashcardsView();
}

function currentStudyCard(){
  return state.studyPool[state.studyIndex] || null;
}

export function flipStudyCard(){
  if(!currentStudyCard()) return;
  state.studyFlipped = !state.studyFlipped;
  renderStudyCard();
}

// Cartões novos respondidos com Errei/Difícil voltam pra fila (alguns
// cartões à frente, não logo em seguida), em vez de sumir da sessão —
// exatamente como o passo de aprendizagem do Anki.
export async function answerCard(rating){
  const card = currentStudyCard();
  if(!card) return;

  const result = computeSchedule(card, rating);
  state.studyScore[rating] = (state.studyScore[rating] || 0) + 1;

  // estatísticas de longo prazo (aba de Análise)
  ensureDailyStatsFresh();
  state.flashcardStats[rating] = (state.flashcardStats[rating] || 0) + 1;
  state.dailyStats.reviewed += 1;
  const now = Date.now();
  if(studySessionLastTick){
    state.dailyStats.studySeconds += Math.max(0, Math.round((now - studySessionLastTick) / 1000));
  }
  studySessionLastTick = now;
  updateStreakOnActivity();

  if(result.requeue){
    const [item] = state.studyPool.splice(state.studyIndex, 1);
    const insertAt = Math.min(state.studyPool.length, state.studyIndex + 3 + Math.floor(Math.random() * 2));
    state.studyPool.splice(insertAt, 0, item);
  } else {
    Object.assign(card, result.patch);
    state.studyIndex += 1;
  }

  await persistAll();
  state.studyFlipped = false;
  renderStudyCard();
}

function renderStudyCard(){
  const card = currentStudyCard();
  const total = state.studyPool.length;
  const s = state.studyScore;

  setHtml('study-score', `
    <span class="score-chip again">${s.again} errei</span>
    <span class="score-chip hard">${s.hard} difícil</span>
    <span class="score-chip good">${s.good} bom</span>
    <span class="score-chip easy">${s.easy} fácil</span>
  `);

  if(!card){
    setText('study-progress', '');
    setHtml('study-body', `
      <div class="empty">
        <strong>Estudo concluído</strong>
        Você respondeu ${s.again + s.hard + s.good + s.easy} vezes nesta sessão. Bom trabalho!
      </div>
    `);
    setHtml('study-actions', `<button class="btn-primary" onclick="exitStudy()">Voltar ao banco de flashcards</button>`);
    return;
  }

  setText('study-progress', `Cartão ${state.studyIndex + 1} de ${total}`);

  const catTag = card.cat
    ? `<span class="tag"><span class="tag-dot" style="background:${colorForCategory(card.cat)}"></span>${escapeHtml(card.cat)}</span>`
    : '';

  setHtml('study-body', `
    ${catTag ? `<div style="text-align:center;margin-bottom:14px;">${catTag}</div>` : ''}
    <div class="flip-card-wrap">
      <div class="flip-card ${state.studyFlipped ? 'flipped' : ''}" onclick="flipStudyCard()">
        <div class="flip-card-face flip-card-front">
          <span class="flip-card-label">Frente</span>
          <p class="flip-card-text">${escapeHtml(card.front)}</p>
        </div>
        <div class="flip-card-face flip-card-back">
          <span class="flip-card-label">Verso</span>
          <p class="flip-card-text">${escapeHtml(card.back)}</p>
        </div>
      </div>
    </div>
    <p class="hint-row" style="justify-content:center;margin-top:14px;">${state.studyFlipped ? 'Como foi lembrar desse cartão? (teclas 1-4)' : 'Toque no cartão ou aperte espaço para virar'}</p>
  `);
  adjustFlipCardHeight();

  let actionsHtml;
  if(!state.studyFlipped){
    actionsHtml = `<button class="btn-primary" onclick="flipStudyCard()">Virar cartão</button>`;
  } else {
    actionsHtml = `
      <button class="rating-btn rating-again" onclick="answerCard('again')">Errei<span>${previewLabel(card, 'again')}</span></button>
      <button class="rating-btn rating-hard" onclick="answerCard('hard')">Difícil<span>${previewLabel(card, 'hard')}</span></button>
      <button class="rating-btn rating-good" onclick="answerCard('good')">Bom<span>${previewLabel(card, 'good')}</span></button>
      <button class="rating-btn rating-easy" onclick="answerCard('easy')">Fácil<span>${previewLabel(card, 'easy')}</span></button>
    `;
  }
  setHtml('study-actions', actionsHtml);
}

// O cartão usa duas faces empilhadas uma sobre a outra (position:absolute)
// pra poder girar em 3D — mas isso significa que a altura da caixa não
// cresce sozinha com o tamanho do texto. Por isso medimos o conteúdo real
// de cada face depois de desenhar, e aplicamos a maior altura ao cartão.
function adjustFlipCardHeight(){
  requestAnimationFrame(() => {
    const flipCard = document.querySelector('.flip-card');
    if(!flipCard) return;
    const front = flipCard.querySelector('.flip-card-front');
    const back = flipCard.querySelector('.flip-card-back');
    const minHeight = 220;
    const maxHeight = Math.max(minHeight, window.innerHeight - 320);
    const natural = Math.max(front?.scrollHeight || 0, back?.scrollHeight || 0, minHeight);
    flipCard.style.height = `${Math.min(natural, maxHeight)}px`;
  });
}

/* ---------------------------------------------------------------------------
   Importação em massa (JSON ou CSV): traga vários flashcards de uma vez em
   vez de criar um por um. Categorias mencionadas que ainda não existem são
   criadas automaticamente, com a próxima cor da paleta.
--------------------------------------------------------------------------- */

export function openImportModal(){
  const fileInput = el('f-import-file');
  const textInput = el('f-import-text');
  if(fileInput) fileInput.value = '';
  if(textInput) textInput.value = '';
  openOverlay('import-overlay');
}
export function closeImportModal(){
  closeOverlay('import-overlay');
}

function readFileAsText(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// Parser simples de formato tabular: lida com campos entre aspas (podendo
// conter o delimitador e quebras de linha) e aspas duplicadas ("") como
// aspas literais — funciona tanto pra CSV (vírgula) quanto pra exports do
// Anki em .txt (tabulação).
function parseDelimited(text, delimiter){
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for(let i = 0; i < text.length; i++){
    const char = text[i];
    if(inQuotes){
      if(char === '"'){
        if(text[i + 1] === '"'){ field += '"'; i++; }
        else inQuotes = false;
      } else field += char;
    } else if(char === '"'){
      inQuotes = true;
    } else if(char === delimiter){
      row.push(field); field = '';
    } else if(char === '\n' || char === '\r'){
      if(char === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if(row.some(v => v !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if(field !== '' || row.length){ row.push(field); if(row.some(v => v !== '')) rows.push(row); }
  return rows;
}

// O Anki exporta linhas de metadados começando com "#" (#separator:tab,
// #html:true, #deck column:1...) — não são dados, e não têm cabeçalho de
// coluna nenhum depois delas, então precisam ser removidas antes de tudo.
function stripAnkiCommentLines(text){
  return text.split(/\r?\n/).filter(line => !line.trimStart().startsWith('#')).join('\n');
}

// Decide se o conteúdo parece separado por tabulação (típico de exports do
// Anki) ou por vírgula (CSV comum de planilha), olhando a primeira linha real.
function detectDelimiter(text){
  const firstLine = text.split(/\r?\n/).find(line => line.trim()) || '';
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return tabs > commas ? '\t' : ',';
}

// Muitos exports (principalmente do Anki) não têm nenhuma linha de
// cabeçalho — é dado puro desde a primeira linha. Se não reconhecermos
// nomes de coluna esperados, caímos num mapeamento por posição.
function csvRowsToObjects(rows){
  if(rows.length === 0) return [];

  const looksLikeHeader = rows[0].some(cell => {
    const c = cell.trim().toLowerCase();
    return ['frente', 'verso', 'categoria', 'front', 'back', 'cat', 'category'].includes(c);
  });

  if(looksLikeHeader){
    const headers = rows[0].map(h => h.trim().toLowerCase());
    return rows.slice(1).map(cols => {
      const obj = {};
      headers.forEach((header, idx) => { obj[header] = (cols[idx] || '').trim(); });
      return obj;
    });
  }

  // sem cabeçalho reconhecível: assume export cru (ex.: Anki)
  return rows.map(cols => {
    // baralho do Anki com hierarquia "Curso::Matéria::Tema" na 1ª coluna —
    // usamos o 2º nível como categoria e as duas colunas seguintes como
    // frente/verso.
    if(cols[0] && cols[0].includes('::') && cols.length >= 3){
      const parts = cols[0].split('::');
      return { frente: cols[1] || '', verso: cols[2] || '', categoria: parts[1] || parts[0] };
    }
    return { frente: cols[0] || '', verso: cols[1] || '', categoria: cols[2] || '' };
  });
}

// Vários exports do Anki incluem o HTML renderizado dos campos
// (#html:true). Se o texto trouxer tags, tiramos e ficamos só com o
// conteúdo legível.
function stripHtmlIfPresent(text){
  if(!text) return text;
  if(!/<[a-z][\s\S]*>/i.test(text)) return text.trim();
  let out = text.replace(/<[^>]+>/g, ' ');
  out = out
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  out = out.replace(/\s+([.,;:!?)])/g, '$1');
  return out.replace(/\s+/g, ' ').trim();
}

function ensureCategoryExists(name){
  const trimmed = (name || '').trim();
  if(!trimmed) return '';
  const existing = state.categories.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
  if(existing) return existing.name;
  const usedColors = state.categories.map(c => c.color);
  const color = CAT_PALETTE.find(c => !usedColors.includes(c)) || CAT_PALETTE[state.categories.length % CAT_PALETTE.length];
  state.categories.push({ id: randomId('c'), name: trimmed, color });
  return trimmed;
}

function buildFlashcardFromParts(front, back, categoryName){
  const cleanFront = stripHtmlIfPresent(front || '');
  const cleanBack = stripHtmlIfPresent(back || '');
  if(!cleanFront || !cleanBack) return null;
  return {
    id: randomId('f'),
    front: cleanFront,
    back: cleanBack,
    cat: ensureCategoryExists(categoryName),
    status: 'new', interval: 0, lapses: 0, due: todayISO(),
    createdAt: new Date().toISOString().slice(0, 10)
  };
}

function normalizeJsonItem(item){
  return buildFlashcardFromParts(
    item.frente ?? item.front,
    item.verso ?? item.back,
    item.categoria ?? item.cat
  );
}
function normalizeCsvItem(row){
  return buildFlashcardFromParts(row.frente, row.verso, row.categoria);
}

export async function runImport(){
  const fileInput = el('f-import-file');
  const textInput = el('f-import-text');
  const file = fileInput && fileInput.files && fileInput.files[0];

  let rawText = '';
  let formatHint = null;
  if(file){
    try{
      rawText = await readFileAsText(file);
    }catch(e){
      showToast('Não foi possível ler o arquivo selecionado.', 'error');
      return;
    }
    if(file.name.toLowerCase().endsWith('.json')) formatHint = 'json';
    else if(file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt')) formatHint = 'csv';
  } else if(textInput){
    rawText = textInput.value;
  }

  rawText = rawText.trim();
  if(!rawText){
    showToast('Escolha um arquivo ou cole o conteúdo para importar.', 'error');
    return;
  }

  let imported = [];
  let skipped = 0;

  const tryJson = formatHint !== 'csv';
  if(tryJson){
    try{
      const parsed = JSON.parse(rawText);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      items.forEach(item => {
        const card = normalizeJsonItem(item);
        if(card) imported.push(card); else skipped++;
      });
    }catch(e){
      if(formatHint === 'json'){
        showToast('O arquivo JSON não pôde ser lido. Confira a formatação.', 'error');
        return;
      }
      formatHint = 'csv';
    }
  }

  if(formatHint === 'csv'){
    const cleaned = stripAnkiCommentLines(rawText);
    const delimiter = detectDelimiter(cleaned);
    const rows = parseDelimited(cleaned, delimiter);
    const objects = csvRowsToObjects(rows);
    if(objects.length === 0){
      showToast('Não encontrei linhas de dados no arquivo.', 'error');
      return;
    }
    objects.forEach(row => {
      const card = normalizeCsvItem(row);
      if(card) imported.push(card); else skipped++;
    });
  }

  if(imported.length === 0){
    showToast('Nenhum flashcard válido encontrado para importar.', 'error');
    return;
  }

  state.flashcards.push(...imported);
  await persistAll();
  closeImportModal();
  renderFlashcardsView();

  const summary = skipped > 0
    ? `${imported.length} flashcards importados, ${skipped} ignorados por estarem incompletos.`
    : `${imported.length} flashcards importados com sucesso.`;
  showToast(summary, 'success');
}

function triggerDownload(filename, content, mimeType){
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadImportTemplate(format){
  if(format === 'csv'){
    const header = 'frente,verso,categoria';
    const sample = '"Qual a tríade de Virchow?","Estase venosa, lesão endotelial e hipercoagulabilidade","Cardiologia"';
    triggerDownload('modelo-flashcards.csv', `${header}\n${sample}\n`, 'text/csv;charset=utf-8');
  } else {
    const example = [{
      frente: 'Qual a tríade de Virchow?',
      verso: 'Estase venosa, lesão endotelial e hipercoagulabilidade',
      categoria: 'Cardiologia'
    }];
    triggerDownload('modelo-flashcards.json', JSON.stringify(example, null, 2), 'application/json;charset=utf-8');
  }
}
