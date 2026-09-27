/**
 * view.js
 * ---------------------------------------------------------------------------
 * Alterna entre as quatro telas do app (Painel / Revisões / Cronograma /
 * Flashcards), mostrando e escondendo os blocos correspondentes de barra
 * lateral e conteúdo principal.
 * ---------------------------------------------------------------------------
 */
import { state } from './state.js';
import { setDisplay } from './dom.js';
import { renderTopics, renderRevisoesSidebar } from './topics.js';
import { renderCronograma, renderCronogramaSidebar } from './cronograma.js';
import { renderFlashcardsView } from './flashcards.js';
import { renderDashboard } from './dashboard.js';

export function setView(view){
  state.currentView = view;

  document.querySelectorAll('.view-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  setDisplay('painel-main', view === 'painel');
  setDisplay('revisoes-sidebar', view === 'revisoes');
  setDisplay('cronograma-sidebar', view === 'cronograma');
  setDisplay('flashcards-sidebar', view === 'flashcards');
  setDisplay('revisoes-main', view === 'revisoes');
  setDisplay('cronograma-main', view === 'cronograma');
  setDisplay('flashcards-main', view === 'flashcards');

  if(view === 'painel'){
    renderDashboard();
  } else if(view === 'cronograma'){
    renderCronogramaSidebar();
    renderCronograma();
  } else if(view === 'flashcards'){
    renderFlashcardsView();
  } else {
    renderTopics();
    renderRevisoesSidebar();
  }
}
