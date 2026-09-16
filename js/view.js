/**
 * view.js
 * ---------------------------------------------------------------------------
 * Alterna entre as duas telas do app (Revisões / Cronograma), mostrando e
 * escondendo os blocos correspondentes de barra lateral e conteúdo principal.
 * ---------------------------------------------------------------------------
 */
import { state } from './state.js';
import { setDisplay } from './dom.js';
import { renderTopics, renderRevisoesSidebar } from './topics.js';
import { renderCronograma, renderCronogramaSidebar } from './cronograma.js';

export function setView(view){
  state.currentView = view;

  document.querySelectorAll('.view-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  setDisplay('revisoes-sidebar', view === 'revisoes');
  setDisplay('cronograma-sidebar', view === 'cronograma');
  setDisplay('revisoes-main', view === 'revisoes');
  setDisplay('cronograma-main', view === 'cronograma');

  if(view === 'cronograma'){
    renderCronogramaSidebar();
    renderCronograma();
  } else {
    renderTopics();
    renderRevisoesSidebar();
  }
}
