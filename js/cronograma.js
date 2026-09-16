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
import { escapeHtml, randomId } from './utils.js';
import { el, setText, setHtml, setDisplay } from './dom.js';
import { openOverlay, closeOverlay } from './modal.js';
import { persistAll } from './firebase-sync.js';

export function currentWeek(){
  return state.weeks[state.currentWeekIndex] || null;
}

/* ---------------------------------------------------------------------------
   Navegação entre semanas
--------------------------------------------------------------------------- */

export function selectWeek(index){
  state.currentWeekIndex = index;
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
  }

  closeWeekModal();
  await persistAll();
  renderCronogramaSidebar();
  renderCronograma();
}

export async function deleteWeek(weekId, event){
  if(event) event.stopPropagation();
  const week = state.weeks.find(w => w.id === weekId);
  if(!week) return;
  const confirmed = confirm(`Excluir "${week.label}" e todas as suas tarefas?`);
  if(!confirmed) return;

  const index = state.weeks.findIndex(w => w.id === weekId);
  state.weeks = state.weeks.filter(w => w.id !== weekId);
  if(state.currentWeekIndex >= index){
    state.currentWeekIndex = Math.max(0, state.currentWeekIndex - 1);
  }

  await persistAll();
  renderCronogramaSidebar();
  renderCronograma();
}

/* ---------------------------------------------------------------------------
   Modal: criar / editar tarefa
--------------------------------------------------------------------------- */

export function openTaskModal(taskId){
  const week = currentWeek();
  if(!week) return;

  state.editingTaskId = taskId || null;
  const task = taskId ? week.tasks.find(t => t.id === taskId) : null;

  setText('task-modal-title', task ? 'Editar tarefa' : 'Nova tarefa');
  const saveBtn = el('save-task-btn');
  if(saveBtn) saveBtn.textContent = task ? 'Salvar alterações' : 'Salvar';

  const titleInput = el('f-task-title');
  if(titleInput) titleInput.value = task ? task.title : '';

  const prioSelect = el('f-task-prio');
  if(prioSelect) prioSelect.value = task ? (task.prio || 'alta') : 'alta';

  openOverlay('task-overlay');
  setTimeout(() => titleInput && titleInput.focus(), 50);
}
export function closeTaskModal(){
  closeOverlay('task-overlay');
  state.editingTaskId = null;
}

export async function saveTask(){
  const week = currentWeek();
  if(!week) return;

  const titleInput = el('f-task-title');
  const prioSelect = el('f-task-prio');
  if(!titleInput || !prioSelect) return;

  const title = titleInput.value.trim();
  if(!title) return;
  const prio = prioSelect.value;

  if(state.editingTaskId){
    const task = week.tasks.find(t => t.id === state.editingTaskId);
    if(task){ task.title = title; task.prio = prio; }
  } else {
    week.tasks.push({ id: randomId('k'), title, prio, done: false });
  }

  closeTaskModal();
  await persistAll();
  renderCronogramaSidebar();
  renderCronograma();
}

export async function toggleTaskDone(taskId){
  const week = currentWeek();
  if(!week) return;
  const task = week.tasks.find(t => t.id === taskId);
  if(!task) return;

  task.done = !task.done;
  await persistAll();
  renderCronogramaSidebar();
  renderCronograma();
}

export async function deleteTask(taskId){
  const week = currentWeek();
  if(!week) return;
  const task = week.tasks.find(t => t.id === taskId);
  if(!task) return;
  const confirmed = confirm(`Excluir a tarefa "${task.title}"?`);
  if(!confirmed) return;

  week.tasks = week.tasks.filter(t => t.id !== taskId);
  await persistAll();
  renderCronogramaSidebar();
  renderCronograma();
}

export function toggleConcluidasGroup(){
  state.concluidasCollapsed = !state.concluidasCollapsed;
  renderCronograma();
}

/* ---------------------------------------------------------------------------
   Renderização
--------------------------------------------------------------------------- */

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

  setHtml('week-nav', state.weeks.map((week, index) => {
    const total = week.tasks.length;
    const done = week.tasks.filter(t => t.done).length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    return `
      <div class="nav-item-wrap">
        <button class="nav-item ${index === state.currentWeekIndex ? 'active' : ''}" onclick="selectWeek(${index})">
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

function taskRowHtml(task){
  return `
    <div class="row task-row ${task.done ? 'done' : ''}" draggable="true" data-id="${task.id}"
         ondragstart="onDragStart(event,'${task.id}','tasks')"
         ondragend="onDragEnd(event)"
         ondragover="onDragOver(event)"
         ondrop="handleDrop(event,'${task.id}','tasks')">
      <span class="drag-handle" title="Arrastar para reordenar"><span></span><span></span><span></span><span></span><span></span><span></span></span>
      <button class="task-check ${task.done ? 'checked' : ''}" onclick="toggleTaskDone('${task.id}')" title="${task.done ? 'Marcar como pendente' : 'Marcar como concluída'}">
        ${task.done ? '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
      </button>
      <div class="row-main">
        <div class="row-top">
          <span class="prio ${task.prio || 'alta'}"><span class="prio-dot"></span>${PRIO_LABEL[task.prio || 'alta']}</span>
          <span class="row-name task-title">${escapeHtml(task.title)}</span>
        </div>
      </div>
      <div class="row-actions">
        <button class="btn-del" onclick="openTaskModal('${task.id}')" title="Editar">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
        </button>
        <button class="btn-del" onclick="deleteTask('${task.id}')" title="Excluir">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>
  `;
}

export function renderCronograma(){
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
    html += `<div class="list">${pending.map(taskRowHtml).join('')}</div>`;
  } else {
    html += `<div class="empty"><strong>Tudo feito por aqui</strong>Todas as tarefas desta semana já foram concluídas.</div>`;
  }

  if(done.length){
    html += `
      <div class="group-header ${state.concluidasCollapsed ? 'collapsed' : ''}" onclick="toggleConcluidasGroup()">
        <svg class="icon chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        Concluídas (${done.length})
      </div>
    `;
    if(!state.concluidasCollapsed){
      html += `<div class="list">${done.map(taskRowHtml).join('')}</div>`;
    }
  }

  setHtml('task-list', html);
}
