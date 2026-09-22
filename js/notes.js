/**
 * notes.js
 * ---------------------------------------------------------------------------
 * Modal de anotações por tema, com formatação de texto (negrito, itálico,
 * sublinhado e marca-texto). O conteúdo é guardado como HTML simples — por
 * isso tudo passa por sanitizeRichText antes de ser salvo ou reaberto, para
 * garantir que só sobrevivem tags de formatação de texto, nunca scripts ou
 * atributos perigosos.
 * ---------------------------------------------------------------------------
 */
import { state } from './state.js';
import { el } from './dom.js';
import { openOverlay, closeOverlay } from './modal.js';
import { persistAll } from './firebase-sync.js';
import { sanitizeRichText } from './utils.js';

const HIGHLIGHT_COLOR = '#fdf2b8';

export function openNotesModal(topicId){
  const topic = state.topics.find(t => t.id === topicId);
  if(!topic) return;

  state.notesTargetId = topicId;
  const nameEl = el('notes-topic-name');
  const editor = el('f-notes');
  if(nameEl) nameEl.textContent = topic.name;
  if(editor) editor.innerHTML = sanitizeRichText(topic.notes || '');

  openOverlay('notes-overlay');
  setTimeout(() => editor && editor.focus(), 50);
}

export function closeNotesModal(){
  closeOverlay('notes-overlay');
  state.notesTargetId = null;
}

export async function saveNotes(){
  const topic = state.topics.find(t => t.id === state.notesTargetId);
  if(!topic) return;
  const editor = el('f-notes');
  topic.notes = editor ? sanitizeRichText(editor.innerHTML) : '';
  closeNotesModal();
  await persistAll();
}

/* ---------------------------------------------------------------------------
   Barra de formatação. document.execCommand ainda é a forma mais simples e
   amplamente suportada de aplicar negrito/itálico/sublinhado/cor num trecho
   selecionado dentro de um contenteditable.
--------------------------------------------------------------------------- */

export function formatNotes(command, value){
  const editor = el('f-notes');
  if(!editor) return;
  editor.focus();
  document.execCommand(command, false, value ?? null);
}

export function highlightNotes(color){
  formatNotes('backColor', color || HIGHLIGHT_COLOR);
}

/* ---------------------------------------------------------------------------
   Cor personalizada (input[type=color] nativo do sistema): abrir o seletor
   do sistema tira o foco do editor por um instante, o que normalmente perde
   o texto selecionado. Por isso guardamos a seleção antes de abrir o
   seletor, e a restauramos assim que uma cor é escolhida.
--------------------------------------------------------------------------- */
let savedSelectionRange = null;

export function saveNotesSelection(){
  const selection = window.getSelection();
  if(selection && selection.rangeCount > 0){
    savedSelectionRange = selection.getRangeAt(0).cloneRange();
  }
}

export function applyCustomHighlight(color){
  const editor = el('f-notes');
  if(!editor) return;
  editor.focus();
  if(savedSelectionRange){
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedSelectionRange);
  }
  document.execCommand('backColor', false, color);
}

export function clearNotesFormatting(){
  formatNotes('removeFormat');
}
