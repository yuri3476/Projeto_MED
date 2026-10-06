/**
 * cronograma.js
 * ---------------------------------------------------------------------------
 * Tela "Cronograma": semanas de estudo, cada uma com sua lista de tarefas
 * (com prioridade e status concluída/pendente), navegação entre semanas, e
 * o resumo de progresso (percentual por semana + total concluído no geral).
 * ---------------------------------------------------------------------------
 */
import { state } from './state.js';
import { PRIO_LABEL } from './config.js';
import { escapeHtml, randomId, todayISO, addDays, fmtDate } from './utils.js';
import { el, setText, setHtml, setDisplay } from './dom.js';
import { openOverlay, closeOverlay } from './modal.js';
import { persistAll } from './firebase-sync.js';
import { showToast } from './toast.js';

export function currentWeek(){
  return state.weeks[state.currentWeekIndex] || null;
}

// Procura uma tarefa em QUALQUER semana (a visão "Hoje" mistura tarefas de
// várias semanas, então não dá pra assumir que ela está na semana aberta).
function findTask(taskId){
  for(const week of state.weeks){
    const index = week.tasks.findIndex(t => t.id === taskId);
    if(index !== -1) return { week, task: week.tasks[index], index };
  }
  return null;
}

/* ---------------------------------------------------------------------------
   "Hoje": tarefas com dia marcado, juntando todas as semanas.
     atrasadas = ainda pendentes, com dia anterior a hoje
     pendentes = pendentes marcadas pra hoje
     feitas    = concluídas que estavam marcadas pra hoje
--------------------------------------------------------------------------- */
function todayTasks(){
  const today = todayISO();
  const overdue = [], pending = [], done = [];
  state.weeks.forEach(week => {
    week.tasks.forEach(task => {
      if(!task.day) return;
      const entry = { task, weekLabel: week.label };
      if(task.day === today){
        (task.done ? done : pending).push(entry);
      } else if(task.day < today && !task.done){
        overdue.push(entry);
      }
    });
  });
  overdue.sort((a, b) => a.task.day.localeCompare(b.task.day));
  return { overdue, pending, done };
}

// Resumo usado pelo Painel e pelo contador da barra lateral.
export function todayTasksCount(){
  const t = todayTasks();
  return { pendentes: t.overdue.length + t.pending.length, feitas: t.done.length };
}

/* ---------------------------------------------------------------------------
   Navegação entre semanas
--------------------------------------------------------------------------- */

export function selectWeek(index){
  state.cronogramaHoje = false;
  state.currentWeekIndex = index;
  renderCronogramaSidebar();
  renderCronograma();
}
export function showCronogramaHoje(){
  state.cronogramaHoje = true;
  renderCronogramaSidebar();
  renderCronograma();
}
export function prevWeek(){
  if(state.currentWeekIndex > 0) selectWeek(state.currentWeekIndex - 1);
}
export function nextWeek(){
  if(state.currentWeekIndex < state.weeks.length - 1) selectWeek(state.currentWeekIndex + 1);
}

/* ---------------------------------------------------------------------------
   Modal: criar / renomear semana
--------------------------------------------------------------------------- */

export function openWeekModal(renameMode){
  state.editingWeekMode = !!renameMode;
  const week = currentWeek();

  setText('week-modal-title', renameMode ? 'Renomear semana' : 'Nova semana');
  const saveBtn = el('save-week-btn');
  if(saveBtn) saveBtn.textContent = renameMode ? 'Salvar' : 'Criar semana';

  const labelInput = el('f-week-label');
  if(labelInput){
    labelInput.value = (renameMode && week) ? week.label : `Semana ${state.weeks.length + 1}`;
  }

  openOverlay('week-overlay');
  setTimeout(() => labelInput && labelInput.focus(), 50);
}
export function closeWeekModal(){
  closeOverlay('week-overlay');
}

export async function saveWeek(){
  const labelInput = el('f-week-label');
  if(!labelInput) return;
  const label = labelInput.value.trim();
  if(!label) return;

  if(state.editingWeekMode){
    const week = currentWeek();
    if(week) week.label = label;
  } else {
    state.weeks.push({ id: randomId('w'), label, tasks: [] });
    state.currentWeekIndex = state.weeks.length - 1;
    state.cronogramaHoje = false;
  }

  closeWeekModal();
  await persistAll();
  renderCronogramaSidebar();
  renderCronograma();
}

export async function deleteWeek(weekId, event){
  if(event) event.stopPropagation();
  const index = state.weeks.findIndex(w => w.id === weekId);
  if(index === -1) return;
  const week = state.weeks[index];
  const confirmed = confirm(`Excluir "${week.label}" e todas as suas tarefas?`);
  if(!confirmed) return;

  state.weeks.splice(index, 1);
  if(state.currentWeekIndex >= index){
    state.currentWeekIndex = Math.max(0, state.currentWeekIndex - 1);
  }

  await persistAll();
  renderCronogramaSidebar();
  renderCronograma();

  showToast(`"${week.label}" excluída.`, 'info', {
    actionLabel: 'Desfazer',
    onAction: async () => {
      state.weeks.splice(index, 0, week);
      state.currentWeekIndex = index;
      await persistAll();
      renderCronogramaSidebar();
      renderCronograma();
    }
  });
}

/* ---------------------------------------------------------------------------
   Modal: criar / editar tarefa
--------------------------------------------------------------------------- */

export function openTaskModal(taskId){
  if(state.weeks.length === 0){
    showToast('Crie uma semana antes de adicionar tarefas.', 'info');
    return;
  }

  const found = taskId ? findTask(taskId) : null;
  if(taskId && !found) return;
  const task = found ? found.task : null;
  state.editingTaskId = taskId || null;

  setText('task-modal-title', task ? 'Editar tarefa' : 'Nova tarefa');
  const saveBtn = el('save-task-btn');
  if(saveBtn) saveBtn.textContent = task ? 'Salvar alterações' : 'Salvar';

  const titleInput = el('f-task-title');
  if(titleInput) titleInput.value = task ? task.title : '';

  const prioSelect = el('f-task-prio');
  if(prioSelect) prioSelect.value = task ? (task.prio || 'alta') : 'alta';

  // criando a partir da visão "Hoje": já vem com o dia de hoje, e pergunta em
  // qual semana a tarefa vai ficar (a visão Hoje não pertence a nenhuma semana)
  const askWeek = !task && state.cronogramaHoje;
  const dayInput = el('f-task-day');
  if(dayInput) dayInput.value = task ? (task.day || '') : (state.cronogramaHoje ? todayISO() : '');

  setDisplay('task-week-field', askWeek);
  if(askWeek){
    const weekSelect = el('f-task-week');
    if(weekSelect){
      weekSelect.innerHTML = state.weeks.map(w => `<option value="${w.id}">${escapeHtml(w.label)}</option>`).join('');
      const current = currentWeek();
      if(current) weekSelect.value = current.id;
    }
  }

  openOverlay('task-overlay');
  setTimeout(() => titleInput && titleInput.focus(), 50);
}
export function closeTaskModal(){
  closeOverlay('task-overlay');
  state.editingTaskId = null;
}

export function setTaskDayToday(){
  const dayInput = el('f-task-day');
  if(dayInput) dayInput.value = todayISO();
}

export async function saveTask(){
  const titleInput = el('f-task-title');
  const prioSelect = el('f-task-prio');
  const dayInput = el('f-task-day');
  if(!titleInput || !prioSelect) return;

  const title = titleInput.value.trim();
  if(!title) return;
  const prio = prioSelect.value;
  const day = dayInput && dayInput.value ? dayInput.value : '';

  if(state.editingTaskId){
    const found = findTask(state.editingTaskId);
    if(found){
      found.task.title = title;
      found.task.prio = prio;
      // o Firestore não aceita campo "undefined": sem dia, o campo é removido
      if(day) found.task.day = day; else delete found.task.day;
    }
  } else {
    let week = currentWeek();
    if(state.cronogramaHoje){
      const weekSelect = el('f-task-week');
      const chosen = weekSelect && state.weeks.find(w => w.id === weekSelect.value);
      if(chosen) week = chosen;
    }
    if(!week) return;
    const task = { id: randomId('k'), title, prio, done: false };
    if(day) task.day = day;
    week.tasks.push(task);
  }

  closeTaskModal();
  await persistAll();
  renderCronogramaSidebar();
  renderCronograma();
}

export async function toggleTaskDone(taskId){
  const found = findTask(taskId);
  if(!found) return;

  found.task.done = !found.task.done;
  await persistAll();
  renderCronogramaSidebar();
  renderCronograma();
}

// Atalho do botão de sol: marca a tarefa pra hoje, ou tira de hoje se já estava.
// (Numa tarefa atrasada, o clique move ela pra hoje.)
export async function toggleTaskToday(taskId){
  const found = findTask(taskId);
  if(!found) return;

  const today = todayISO();
  if(found.task.day === today) delete found.task.day;
  else found.task.day = today;

  await persistAll();
  renderCronogramaSidebar();
  renderCronograma();
}

export async function deleteTask(taskId){
  const found = findTask(taskId);
  if(!found) return;
  const { week, task, index } = found;
  const weekId = week.id;
  const confirmed = confirm(`Excluir a tarefa "${task.title}"?`);
  if(!confirmed) return;

  week.tasks.splice(index, 1);
  await persistAll();
  renderCronogramaSidebar();
  renderCronograma();

  showToast(`Tarefa "${task.title}" excluída.`, 'info', {
    actionLabel: 'Desfazer',
    onAction: async () => {
      // busca a semana de novo pelo id: depois de salvar, a lista de semanas
      // é substituída por cópias novas, e a referência `week` de cima ficou solta.
      const liveWeek = state.weeks.find(w => w.id === weekId);
      if(!liveWeek) return;
      liveWeek.tasks.splice(Math.min(index, liveWeek.tasks.length), 0, task);
      await persistAll();
      renderCronogramaSidebar();
      renderCronograma();
    }
  });
}

export function toggleConcluidasGroup(){
  state.concluidasCollapsed = !state.concluidasCollapsed;
  renderCronograma();
}

/* ---------------------------------------------------------------------------
   Renderização
--------------------------------------------------------------------------- */

const SUN_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><line x1="12" y1="2" x2="12" y2="4"></line><line x1="12" y1="20" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"></line><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="4" y2="12"></line><line x1="20" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"></line><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"></line></svg>';

export function renderCronogramaSidebar(){
  const doneAcrossAllWeeks = state.weeks.reduce(
    (sum, week) => sum + week.tasks.filter(t => t.done).length, 0
  );

  setDisplay('week-total-box', doneAcrossAllWeeks > 0);
  if(doneAcrossAllWeeks > 0) setText('week-total-count', doneAcrossAllWeeks);

  if(state.weeks.length === 0){
    setHtml('week-nav', `<p style="font-size:12px;color:var(--text-muted);padding:2px 8px;margin:2px 0 0;">Nenhuma semana ainda. Toque em + para criar.</p>`);
    return;
  }

  const hojeItem = `
    <button class="nav-item ${state.cronogramaHoje ? 'active' : ''}" onclick="showCronogramaHoje()" title="Tarefas marcadas para hoje, de todas as semanas">
      <span class="nav-icon-slot">${SUN_ICON}</span>
      <span class="nav-label">Hoje</span>
      <span class="nav-count">${todayTasksCount().pendentes}</span>
    </button>
  `;

  setHtml('week-nav', hojeItem + state.weeks.map((week, index) => {
    const total = week.tasks.length;
    const done = week.tasks.filter(t => t.done).length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    return `
      <div class="nav-item-wrap">
        <button class="nav-item ${(!state.cronogramaHoje && index === state.currentWeekIndex) ? 'active' : ''}" onclick="selectWeek(${index})">
          <span class="nav-icon-slot"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></span>
          <span class="nav-label">${escapeHtml(week.label)}</span>
          <span class="nav-count">${total ? percent + '%' : '—'}</span>
        </button>
        <button class="nav-del" onclick="deleteWeek('${week.id}', event)" title="Excluir semana">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `;
  }).join(''));
}

// Etiqueta com o dia marcado na tarefa (Hoje / Amanhã / Atrasada / data).
function dayChipHtml(task, inTodayView){
  if(!task.day) return '';
  const today = todayISO();
  if(task.day === today) return inTodayView ? '' : '<span class="day-chip hoje">Hoje</span>';
  if(task.day < today && !task.done) return `<span class="day-chip atrasada">Atrasada (${fmtDate(task.day)})</span>`;
  if(task.day === addDays(today, 1)) return '<span class="day-chip">Amanhã</span>';
  return `<span class="day-chip">${fmtDate(task.day)}</span>`;
}

// ctx.inTodayView: linha dentro da visão "Hoje" (mistura semanas: mostra a
//   semana de origem e não permite arrastar pra reordenar).
function taskRowHtml(task, ctx = {}){
  const inTodayView = !!ctx.inTodayView;
  const isToday = task.day === todayISO();
  const dragAttrs = inTodayView ? '' : `draggable="true"
         ondragstart="onDragStart(event,'${task.id}','tasks')"
         ondragend="onDragEnd(event)"
         ondragover="onDragOver(event)"
         ondrop="handleDrop(event,'${task.id}','tasks')"`;
  const handle = inTodayView ? '' : '<span class="drag-handle" title="Arrastar para reordenar"><span></span><span></span><span></span><span></span><span></span><span></span></span>';
  const weekTag = (inTodayView && ctx.weekLabel) ? `<span class="tag">${escapeHtml(ctx.weekLabel)}</span>` : '';

  return `
    <div class="row task-row ${task.done ? 'done' : ''}" data-id="${task.id}" ${dragAttrs}>
      ${handle}
      <button class="task-check ${task.done ? 'checked' : ''}" onclick="toggleTaskDone('${task.id}')" title="${task.done ? 'Marcar como pendente' : 'Marcar como concluída'}">
        ${task.done ? '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
      </button>
      <div class="row-main">
        <div class="row-top">
          <span class="prio ${task.prio || 'alta'}"><span class="prio-dot"></span>${PRIO_LABEL[task.prio || 'alta']}</span>
          <span class="row-name task-title">${escapeHtml(task.title)}</span>
          ${dayChipHtml(task, inTodayView)}${weekTag}
        </div>
      </div>
      <div class="row-actions">
        <button class="btn-del btn-today ${isToday ? 'has-today' : ''}" onclick="toggleTaskToday('${task.id}')" title="${isToday ? 'Tirar de hoje' : 'Fazer hoje'}">
          ${SUN_ICON}
        </button>
        <button class="btn-del btn-edit" onclick="openTaskModal('${task.id}')" title="Editar">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
        </button>
        <button class="btn-del" onclick="deleteTask('${task.id}')" title="Excluir">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>
  `;
}

function setWeekControlsVisible(visible){
  ['week-prev-btn', 'week-next-btn', 'week-rename-btn'].forEach(id => setDisplay(id, visible));
}

function concluidasHeader(count){
  return `
    <div class="group-header ${state.concluidasCollapsed ? 'collapsed' : ''}" onclick="toggleConcluidasGroup()">
      <svg class="icon chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      Concluídas (${count})
    </div>
  `;
}

function renderCronogramaHoje(){
  setWeekControlsVisible(false);
  const { overdue, pending, done } = todayTasks();
  const total = overdue.length + pending.length + done.length;
  const percent = total ? Math.round((done.length / total) * 100) : 0;

  const progressFill = el('week-progress-fill');
  if(progressFill) progressFill.style.width = percent + '%';

  const dateText = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const dateLabel = dateText.charAt(0).toUpperCase() + dateText.slice(1);

  setText('week-title', 'Hoje');
  setText('week-subtitle', total
    ? `${dateLabel}: ${done.length} de ${total} tarefas concluídas (${percent}%)`
    : dateLabel);

  if(total === 0){
    setHtml('task-list', `<div class="empty"><strong>Nenhuma tarefa para hoje</strong>Abra uma semana e toque no sol (☀) nas tarefas que você quer fazer hoje, ou escolha um dia ao criar ou editar a tarefa.</div>`);
    return;
  }

  const rows = entries => entries.map(e => taskRowHtml(e.task, { inTodayView: true, weekLabel: e.weekLabel })).join('');

  let html = '';
  if(overdue.length){
    html += `<div class="group-header" style="color:var(--brick);cursor:default;">Atrasadas (${overdue.length})</div>`;
    html += `<div class="list">${rows(overdue)}</div>`;
  }
  if(pending.length){
    html += `<div class="group-header" style="cursor:default;">Para hoje (${pending.length})</div>`;
    html += `<div class="list">${rows(pending)}</div>`;
  } else if(overdue.length === 0){
    html += `<div class="empty"><strong>Tudo feito por hoje</strong>Todas as tarefas de hoje já foram concluídas.</div>`;
  }
  if(done.length){
    html += concluidasHeader(done.length);
    if(!state.concluidasCollapsed) html += `<div class="list">${rows(done)}</div>`;
  }
  setHtml('task-list', html);
}

export function renderCronograma(){
  // se todas as semanas foram apagadas enquanto "Hoje" estava aberto, volta ao normal
  if(state.cronogramaHoje && state.weeks.length === 0) state.cronogramaHoje = false;
  if(state.cronogramaHoje){
    renderCronogramaHoje();
    return;
  }
  setWeekControlsVisible(true);

  const week = currentWeek();
  const progressFill = el('week-progress-fill');

  if(!week){
    setText('week-title', 'Cronograma');
    setText('week-subtitle', 'Crie sua primeira semana para começar.');
    if(progressFill) progressFill.style.width = '0%';
    setHtml('task-list', `<div class="empty"><strong>Nenhuma semana criada</strong>Clique em "+ Nova semana" na barra lateral para montar seu cronograma.</div>`);
    return;
  }

  setText('week-title', week.label);
  const total = week.tasks.length;
  const doneCount = week.tasks.filter(t => t.done).length;
  const percent = total ? Math.round((doneCount / total) * 100) : 0;
  if(progressFill) progressFill.style.width = percent + '%';

  setText('week-subtitle', total
    ? `${doneCount} de ${total} tarefas concluídas (${percent}%)`
    : 'Nenhuma tarefa nesta semana ainda.');

  if(total === 0){
    setHtml('task-list', `<div class="empty"><strong>Semana vazia</strong>Clique em "Nova tarefa" para começar a montar essa semana.</div>`);
    return;
  }

  const pending = week.tasks.filter(t => !t.done);
  const done = week.tasks.filter(t => t.done);

  let html = '';
  if(pending.length){
    html += `<div class="group-header">A fazer (${pending.length})</div>`;
    html += `<div class="list">${pending.map(t => taskRowHtml(t)).join('')}</div>`;
  } else {
    html += `<div class="empty"><strong>Tudo feito por aqui</strong>Todas as tarefas desta semana já foram concluídas.</div>`;
  }

  if(done.length){
    html += concluidasHeader(done.length);
    if(!state.concluidasCollapsed){
      html += `<div class="list">${done.map(t => taskRowHtml(t)).join('')}</div>`;
    }
  }

  setHtml('task-list', html);
}
