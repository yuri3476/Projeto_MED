/**
 * search.js
 * ---------------------------------------------------------------------------
 * Busca global (Ctrl+K / Cmd+K): encontra um tema, flashcard ou tarefa do
 * cronograma não importa em qual tela você esteja, e leva direto pra ele.
 * ---------------------------------------------------------------------------
 */
import { state } from './state.js';
import { el, setHtml } from './dom.js';
import { openOverlay, closeOverlay } from './modal.js';
import { escapeHtml } from './utils.js';
import { setView } from './view.js';
import { openTopicModal } from './topics.js';
import { openFlashcardModal } from './flashcards.js';
import { openTaskModal, selectWeek } from './cronograma.js';

const MAX_PER_GROUP = 6;

export function openSearchModal(){
  const input = el('global-search-input');
  if(input) input.value = '';
  renderSearchResults('');
  openOverlay('search-overlay');
  setTimeout(() => input && input.focus(), 50);
}

export function closeSearchModal(){
  closeOverlay('search-overlay');
}

export function handleSearchInput(){
  const input = el('global-search-input');
  renderSearchResults(input ? input.value : '');
}

function searchResultRow(title, meta, onclickCall){
  return `
    <button class="search-result" onclick="${onclickCall}">
      <span class="search-result-title">${escapeHtml(title)}</span>
      ${meta ? `<span class="search-result-meta">${escapeHtml(meta)}</span>` : ''}
    </button>
  `;
}

function renderSearchResults(rawQuery){
  const list = el('global-search-results');
  if(!list) return;

  const q = rawQuery.trim().toLowerCase();
  if(!q){
    list.innerHTML = `<p class="search-hint">Digite para buscar em temas, flashcards e tarefas do cronograma.</p>`;
    return;
  }

  const topicMatches = state.topics
    .filter(t => t.name.toLowerCase().includes(q) || (t.cat || '').toLowerCase().includes(q))
    .slice(0, MAX_PER_GROUP);

  const flashcardMatches = state.flashcards
    .filter(c => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q))
    .slice(0, MAX_PER_GROUP);

  const taskMatches = [];
  state.weeks.forEach((week, weekIndex) => {
    week.tasks.forEach(task => {
      if(task.title.toLowerCase().includes(q)){
        taskMatches.push({ task, weekIndex, weekLabel: week.label });
      }
    });
  });
  const limitedTasks = taskMatches.slice(0, MAX_PER_GROUP);

  if(topicMatches.length === 0 && flashcardMatches.length === 0 && limitedTasks.length === 0){
    list.innerHTML = `<p class="search-hint">Nada encontrado para "${escapeHtml(rawQuery)}".</p>`;
    return;
  }

  let html = '';
  if(topicMatches.length){
    html += `<div class="search-group-label">Temas</div>`;
    html += topicMatches.map(t => searchResultRow(t.name, t.cat, `openSearchResultTopic('${t.id}')`)).join('');
  }
  if(flashcardMatches.length){
    html += `<div class="search-group-label">Flashcards</div>`;
    html += flashcardMatches.map(c => searchResultRow(c.front, c.cat, `openSearchResultFlashcard('${c.id}')`)).join('');
  }
  if(limitedTasks.length){
    html += `<div class="search-group-label">Cronograma</div>`;
    html += limitedTasks.map(({ task, weekIndex, weekLabel }) =>
      searchResultRow(task.title, weekLabel, `openSearchResultTask('${task.id}', ${weekIndex})`)
    ).join('');
  }
  list.innerHTML = html;
}

export function openSearchResultTopic(id){
  closeSearchModal();
  setView('revisoes');
  setTimeout(() => openTopicModal(id), 60);
}

export function openSearchResultFlashcard(id){
  closeSearchModal();
  setView('flashcards');
  setTimeout(() => openFlashcardModal(id), 60);
}

export function openSearchResultTask(taskId, weekIndex){
  closeSearchModal();
  setView('cronograma');
  setTimeout(() => {
    selectWeek(weekIndex);
    openTaskModal(taskId);
  }, 60);
}
