/**
 * state.js
 * ---------------------------------------------------------------------------
 * Estado central da aplicação. Todos os módulos importam este mesmo objeto
 * `state` e leem/alteram suas propriedades diretamente — como é um único
 * objeto compartilhado, qualquer mudança feita por um módulo é vista
 * imediatamente pelos outros, sem precisar de funções "setState" repetidas.
 * ---------------------------------------------------------------------------
 */
import { CAT_PALETTE, FSRS_WEIGHTS, FSRS_REQUEST_RETENTION, DAILY_REVIEW_GOAL } from './config.js';

export const state = {
  // dados sincronizados com o Firestore
  topics: [],
  categories: [],
  weeks: [],
  flashcards: [],

  // filtros / navegação da tela de Revisões
  currentView: 'revisoes',
  currentFilter: 'todos',
  currentPrioFilter: 'todas',
  currentCatFilter: null,

  // navegação da tela de Cronograma
  currentWeekIndex: 0,
  concluidasCollapsed: false,

  // controle de qual item está sendo editado em cada modal
  editingTopicId: null,
  editingWeekMode: false,
  editingTaskId: null,
  reviewTargetId: null,
  notesTargetId: null,
  editingFlashcardId: null,
  editingCategoryId: null,
  flashcardsCatFilter: null,
  flashcardsSubView: 'bank', // 'bank' | 'study' | 'analytics'
  studying: false,
  studyFlipped: false,
  studyPool: [],
  studyIndex: 0,
  studyScore: { again: 0, hard: 0, good: 0, easy: 0 },

  // estatísticas dos flashcards (sincronizadas, para a aba de Análise)
  flashcardStats: { again: 0, hard: 0, good: 0, easy: 0 },
  dailyStats: { date: null, reviewed: 0, studySeconds: 0 },
  streak: { count: 0, lastDate: null },

  // ajustáveis pela tela de Configurações (em vez de fixos no código)
  settings: {
    dailyGoal: DAILY_REVIEW_GOAL,
    fsrsRetention: FSRS_REQUEST_RETENTION,
    fsrsWeights: [...FSRS_WEIGHTS]
  },

  // arrastar-e-soltar (compartilhado entre temas e tarefas)
  draggedId: null,
  draggedScope: 'topics',

  // cor selecionada no momento no criador de categorias
  selectedSwatch: CAT_PALETTE[0],

  // sincronização com o Firestore
  currentDocRef: null,
  unsubscribeSnapshot: null
};
