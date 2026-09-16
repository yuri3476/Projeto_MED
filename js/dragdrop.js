/**
 * dragdrop.js
 * ---------------------------------------------------------------------------
 * Arrastar-e-soltar para reordenar listas. Funciona tanto para os temas de
 * revisão quanto para as tarefas do cronograma através do parâmetro `scope`
 * ('topics' ou 'tasks') — a lógica de arrastar em si é a mesma nos dois casos,
 * só muda qual array é reordenado.
 * ---------------------------------------------------------------------------
 */
import { state } from './state.js';
import { persistAll } from './firebase-sync.js';

function arrayForScope(scope){
  if(scope === 'tasks'){
    const week = state.weeks[state.currentWeekIndex];
    return week ? week.tasks : null;
  }
  return state.topics;
}

export function onDragStart(event, id, scope){
  state.draggedId = id;
  state.draggedScope = scope || 'topics';
  event.dataTransfer.effectAllowed = 'move';
  event.currentTarget.classList.add('dragging');
}

export function onDragEnd(event){
  event.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.row').forEach(row => row.classList.remove('drag-over-top', 'drag-over-bottom'));
}

export function onDragOver(event){
  event.preventDefault();
  const row = event.currentTarget;
  const rect = row.getBoundingClientRect();
  const midpoint = rect.top + rect.height / 2;
  document.querySelectorAll('.row').forEach(r => {
    if(r !== row) r.classList.remove('drag-over-top', 'drag-over-bottom');
  });
  row.classList.toggle('drag-over-top', event.clientY < midpoint);
  row.classList.toggle('drag-over-bottom', event.clientY >= midpoint);
}

/**
 * Executa a troca de posição e salva. Devolve qual escopo foi reordenado
 * ('topics' | 'tasks' | null), para quem chamou decidir o que re-renderizar.
 */
export async function onDrop(event, targetId, scope){
  event.preventDefault();
  document.querySelectorAll('.row').forEach(row => row.classList.remove('drag-over-top', 'drag-over-bottom'));

  const activeScope = scope || state.draggedScope;
  if(!state.draggedId || state.draggedId === targetId) return null;

  const list = arrayForScope(activeScope);
  if(!list) return null;

  const row = event.currentTarget;
  const rect = row.getBoundingClientRect();
  const insertBefore = event.clientY < rect.top + rect.height / 2;

  const fromIndex = list.findIndex(item => item.id === state.draggedId);
  if(fromIndex === -1) return null;

  const [moved] = list.splice(fromIndex, 1);
  let toIndex = list.findIndex(item => item.id === targetId);
  if(toIndex === -1){
    list.splice(fromIndex, 0, moved); // alvo sumiu — desfaz
    return null;
  }
  if(!insertBefore) toIndex += 1;
  list.splice(toIndex, 0, moved);

  state.draggedId = null;
  await persistAll();
  return activeScope;
}
