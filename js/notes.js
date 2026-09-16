/**
 * notes.js
 * ---------------------------------------------------------------------------
 * Modal de anotações por tema. Abre pré-preenchido com o texto salvo e só
 * grava quando o usuário clica em "Salvar anotações".
 * ---------------------------------------------------------------------------
 */
import { state } from './state.js';
import { el } from './dom.js';
import { openOverlay, closeOverlay } from './modal.js';
import { persistAll } from './firebase-sync.js';

export function openNotesModal(topicId){
  const topic = state.topics.find(t => t.id === topicId);
  if(!topic) return;

  state.notesTargetId = topicId;
  const nameEl = el('notes-topic-name');
  const textarea = el('f-notes');
  if(nameEl) nameEl.textContent = topic.name;
  if(textarea) textarea.value = topic.notes || '';

  openOverlay('notes-overlay');
  setTimeout(() => textarea && textarea.focus(), 50);
}

export function closeNotesModal(){
  closeOverlay('notes-overlay');
  state.notesTargetId = null;
}

export async function saveNotes(){
  const topic = state.topics.find(t => t.id === state.notesTargetId);
  if(!topic) return;
  const textarea = el('f-notes');
  topic.notes = textarea ? textarea.value : '';
  closeNotesModal();
  await persistAll();
}
