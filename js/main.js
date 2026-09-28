/**
 * main.js
 * ---------------------------------------------------------------------------
 * Ponto de entrada do app. É o único arquivo que o index.html carrega
 * diretamente (<script type="module" src="js/main.js">). Responsabilidades:
 *
 *   1. Importar as funções de cada módulo de feature.
 *   2. Expô-las em `window` para os atributos onclick="..." do HTML
 *      (necessário porque módulos ES não criam variáveis globais sozinhos).
 *   3. Ligar os event listeners "estruturais" (busca, clique-fora-fecha,
 *      atalhos de teclado) que não pertencem a nenhuma feature específica.
 *   4. Registrar um handler global de erros, para que problemas inesperados
 *      apareçam como um aviso para o usuário em vez de falhar em silêncio.
 *   5. Iniciar a sincronização com o Firebase assim que a página carrega.
 * ---------------------------------------------------------------------------
 */
import { state } from './state.js';
import { initTheme, toggleTheme } from './theme.js';
import { openSettingsModal, closeSettingsModal, saveSettings, resetFsrsWeights, exportBackup, importBackup } from './settings.js';
import { renderDashboard, goToRevisoes, goToCronograma, goToFlashcards, goStudyFlashcardsNow, startFirstCategory, startFirstTopic, startFirstFlashcard } from './dashboard.js';
import { openSearchModal, closeSearchModal, handleSearchInput, openSearchResultTopic, openSearchResultFlashcard, openSearchResultTask } from './search.js';
import { showToast } from './toast.js';
import { isOverlayOpen, wireOverlayBackdropDismiss, closeOverlay } from './modal.js';
import { onSync, getSavedSyncCode, initSync } from './firebase-sync.js';
import { createNewSyncCode, useEnteredSyncCode, openSyncSettings, closeSyncModal, copySyncCode } from './sync-ui.js';
import { setView } from './view.js';
import {
  renderTopics, renderRevisoesSidebar,
  openTopicModal, closeTopicModal, saveTopic, deleteTopic,
  openReviewModal, closeReviewModal, submitReview,
  openHistoryEditModal, closeHistoryEditModal, saveHistoryEdit,
  setStatusFilter, setCategoryFilter, setPriorityFilter
} from './topics.js';
import {
  openCategoryModal, closeCategoryModal, pickCategorySwatch, saveCategory, deleteCategory
} from './categories.js';
import { openNotesModal, closeNotesModal, saveNotes, formatNotes, highlightNotes, clearNotesFormatting, saveNotesSelection, applyCustomHighlight, toggleHighlightPicker, closeHighlightPicker } from './notes.js';
import {
  renderCronograma, renderCronogramaSidebar,
  selectWeek, prevWeek, nextWeek,
  openWeekModal, closeWeekModal, saveWeek, deleteWeek,
  openTaskModal, closeTaskModal, saveTask, toggleTaskDone, deleteTask,
  toggleConcluidasGroup
} from './cronograma.js';
import { onDragStart, onDragEnd, onDragOver, onDrop } from './dragdrop.js';
import {
  renderFlashcardsView,
  openFlashcardModal, closeFlashcardModal, saveFlashcard, deleteFlashcard,
  setFlashcardsCatFilter, deleteFlashcardsInCategory,
  startStudy, exitStudy, flipStudyCard, answerCard,
  showFlashcardsAnalytics, hideFlashcardsAnalytics,
  openImportModal, closeImportModal, runImport, downloadImportTemplate
} from './flashcards.js';

/* ---------------------------------------------------------------------------
   Re-renderização: sempre que os dados mudam (chegou algo novo do Firestore,
   ou terminamos uma ação local), atualizamos as duas telas — assim, trocar
   de visão fica instantâneo, sem esperar recalcular nada.
--------------------------------------------------------------------------- */
function refreshEverything(){
  renderTopics();
  renderRevisoesSidebar();
  renderCronogramaSidebar();
  renderCronograma();
  // não redesenha a tela de estudo enquanto uma sessão está em andamento —
  // isso evita uma corrida: salvar no Firebase dispara essa função de volta,
  // e se ela redesenhasse o cartão no meio da troca pro próximo, mostrava o
  // verso do cartão errado por uma fração de segundo. A tela de estudo já se
  // atualiza sozinha a cada resposta (via answerCard/flipStudyCard).
  if(!state.studying){
    renderFlashcardsView();
  }
  renderDashboard();
}
onSync(refreshEverything);

/* ---------------------------------------------------------------------------
   Arrastar-e-soltar: dragdrop.js só mexe nos dados; aqui decidimos qual
   parte da tela precisa ser redesenhada depois (temas ou tarefas).
--------------------------------------------------------------------------- */
async function handleDrop(event, targetId, scope){
  const usedScope = await onDrop(event, targetId, scope);
  if(usedScope === 'tasks'){
    renderCronogramaSidebar();
    renderCronograma();
  } else if(usedScope === 'topics'){
    renderTopics();
  }
}

/* ---------------------------------------------------------------------------
   Expor funções para os atributos onclick="..." do HTML.
--------------------------------------------------------------------------- */
Object.assign(window, {
  toggleTheme,
  openSettingsModal, closeSettingsModal, saveSettings, resetFsrsWeights, exportBackup, importBackup,
  goToRevisoes, goToCronograma, goToFlashcards, goStudyFlashcardsNow,
  startFirstCategory, startFirstTopic, startFirstFlashcard,
  openSearchModal, closeSearchModal, handleSearchInput, openSearchResultTopic, openSearchResultFlashcard, openSearchResultTask,
  // temas
  openTopicModal, closeTopicModal, saveTopic, deleteTopic,
  openReviewModal, closeReviewModal, submitReview,
  openHistoryEditModal, closeHistoryEditModal, saveHistoryEdit,
  setStatusFilter, setCategoryFilter, setPriorityFilter,
  // categorias
  openCategoryModal, closeCategoryModal, pickCategorySwatch, saveCategory: () => saveCategory(onCategoryCreated), deleteCategory,
  // anotações
  openNotesModal, closeNotesModal, saveNotes, formatNotes, highlightNotes, clearNotesFormatting, saveNotesSelection, applyCustomHighlight, toggleHighlightPicker, closeHighlightPicker,
  // cronograma
  selectWeek, prevWeek, nextWeek,
  openWeekModal, closeWeekModal, saveWeek, deleteWeek,
  openTaskModal, closeTaskModal, saveTask, toggleTaskDone, deleteTask,
  toggleConcluidasGroup,
  // navegação entre telas
  setView,
  // sincronização
  createNewSyncCode, useEnteredSyncCode, openSyncSettings, closeSyncModal, copySyncCode,
  // arrastar-e-soltar
  onDragStart, onDragEnd, onDragOver, handleDrop,
  // questões
  // flashcards
  openFlashcardModal, closeFlashcardModal, saveFlashcard, deleteFlashcard,
  setFlashcardsCatFilter, deleteFlashcardsInCategory,
  startStudy, exitStudy, flipStudyCard, answerCard,
  showFlashcardsAnalytics, hideFlashcardsAnalytics,
  openImportModal, closeImportModal, runImport, downloadImportTemplate
});

// Quando uma categoria é criada a partir do formulário de tema (botão "+" ao
// lado do <select>), a categoria nova já deve aparecer selecionada ali.
function onCategoryCreated(newCategoryName){
  if(isOverlayOpen('overlay')){
    import('./categories.js').then(({ populateCategorySelect }) => {
      populateCategorySelect();
      const select = document.getElementById('f-cat');
      if(select) select.value = newCategoryName;
    });
  }
  renderTopics();
  renderRevisoesSidebar();
}

/* ---------------------------------------------------------------------------
   Fechar modais ao clicar fora, e atalhos de teclado (Enter confirma,
   Esc cancela) — comportamento comum a todos os modais do app.
--------------------------------------------------------------------------- */
const OVERLAYS_WITH_BACKDROP_DISMISS = [
  ['overlay', closeTopicModal],
  ['review-overlay', closeReviewModal],
  ['history-edit-overlay', closeHistoryEditModal],
  ['cat-overlay', closeCategoryModal],
  ['notes-overlay', closeNotesModal],
  ['task-overlay', closeTaskModal],
  ['week-overlay', closeWeekModal],
  ['flashcard-overlay', closeFlashcardModal],
  ['import-overlay', closeImportModal],
  ['settings-overlay', closeSettingsModal],
  ['search-overlay', closeSearchModal]
];
OVERLAYS_WITH_BACKDROP_DISMISS.forEach(([id, close]) => wireOverlayBackdropDismiss(id, close));

// o painel de cores do marca-texto fecha ao clicar fora dele
document.addEventListener('click', (event) => {
  const wrap = document.querySelector('.notes-highlight-wrap');
  if(wrap && !wrap.contains(event.target)){
    closeHighlightPicker();
  }
});

document.getElementById('search')?.addEventListener('input', renderTopics);
document.getElementById('flashcard-search')?.addEventListener('input', renderFlashcardsView);
document.getElementById('f-score')?.addEventListener('input', e => { e.target.style.borderColor = 'var(--border)'; });
document.getElementById('f-history-score')?.addEventListener('input', e => { e.target.style.borderColor = 'var(--border)'; });
document.getElementById('f-cat-name')?.addEventListener('input', e => { e.target.style.borderColor = 'var(--border)'; });
document.getElementById('f-flashcard-front')?.addEventListener('input', e => { e.target.style.borderColor = 'var(--border)'; });
document.getElementById('f-flashcard-back')?.addEventListener('input', e => { e.target.style.borderColor = 'var(--border)'; });
document.getElementById('f-flashcard-stability')?.addEventListener('input', e => { e.target.style.borderColor = 'var(--border)'; });
document.getElementById('f-flashcard-difficulty')?.addEventListener('input', e => { e.target.style.borderColor = 'var(--border)'; });

document.addEventListener('keydown', (event) => {
  // Ctrl+K (ou Cmd+K no Mac) abre a busca global de qualquer lugar do app
  if((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'){
    event.preventDefault();
    openSearchModal();
    return;
  }

  // atalhos do modo de estudo (não disparam se algum campo de texto estiver
  // em foco, pra não atrapalhar quem está digitando em outro lugar)
  const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if(state.studying && !typing){
    if(!state.studyFlipped && (event.key === ' ' || event.code === 'Space')){
      event.preventDefault();
      flipStudyCard();
      return;
    }
    if(state.studyFlipped && ['1', '2', '3', '4'].includes(event.key)){
      event.preventDefault();
      const ratingByKey = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
      answerCard(ratingByKey[event.key]);
      return;
    }
  }

  if(event.key === 'Enter'){
    if(isOverlayOpen('overlay')) saveTopic();
    else if(isOverlayOpen('review-overlay')) submitReview();
    else if(isOverlayOpen('history-edit-overlay')) saveHistoryEdit();
    else if(isOverlayOpen('cat-overlay')) saveCategory(onCategoryCreated);
    else if(isOverlayOpen('task-overlay')) saveTask();
    else if(isOverlayOpen('week-overlay')) saveWeek();
  }
  if(event.key === 'Escape'){
    closeTopicModal();
    closeReviewModal();
    closeHistoryEditModal();
    closeCategoryModal();
    closeNotesModal();
    closeTaskModal();
    closeWeekModal();
    closeFlashcardModal();
    closeImportModal();
    closeSettingsModal();
    closeSearchModal();
  }
});

/* ---------------------------------------------------------------------------
   Tratamento de erros global: qualquer exceção não tratada em qualquer lugar
   do app aparece como um aviso discreto, em vez de a tela simplesmente
   parar de responder sem explicação.
--------------------------------------------------------------------------- */
window.addEventListener('error', (event) => {
  console.error('[revisões] erro inesperado:', event.error || event.message);
  showToast('Algo deu errado. Se o problema continuar, recarregue a página.', 'error');
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[revisões] promessa rejeitada sem tratamento:', event.reason);
  showToast('Algo deu errado ao processar uma ação. Tente novamente.', 'error');
});

/* ---------------------------------------------------------------------------
   Boot: conecta automaticamente se já existe um código salvo neste
   navegador; caso contrário, pede para criar ou informar um código.
--------------------------------------------------------------------------- */
initTheme();

const savedCode = getSavedSyncCode();
if(savedCode){
  closeOverlay('sync-overlay');
  document.getElementById('sync-cancel-btn')?.style && (document.getElementById('sync-cancel-btn').style.display = '');
  initSync(savedCode);
} else {
  document.getElementById('sync-overlay')?.classList.add('open');
}

// tela inicial: mostra "Painel" por padrão
setView('painel');

/* ---------------------------------------------------------------------------
   PWA: registra o Service Worker (deixa o app instalável e mais rápido em
   visitas seguintes). Se o navegador não suportar, ou o registro falhar,
   o app continua funcionando normalmente — é só uma melhoria opcional.
--------------------------------------------------------------------------- */
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.warn('[revisões] não foi possível registrar o service worker:', err);
  });
}
