/**
 * state.js
 * ---------------------------------------------------------------------------
 * Estado central da aplicação. Todos os módulos importam este mesmo objeto
 * `state` e leem/alteram suas propriedades diretamente — como é um único
 * objeto compartilhado, qualquer mudança feita por um módulo é vista
 * imediatamente pelos outros, sem precisar de funções "setState" repetidas.
 * ---------------------------------------------------------------------------
 */
import { CAT_PALETTE } from './config.js';

export const state = {
  // dados sincronizados com o Firestore
  topics: [],
  categories: [],
  weeks: [],

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

  // arrastar-e-soltar (compartilhado entre temas e tarefas)
  draggedId: null,
  draggedScope: 'topics',

  // cor selecionada no momento no criador de categorias
  selectedSwatch: CAT_PALETTE[0],

  // sincronização com o Firestore
  currentDocRef: null,
  unsubscribeSnapshot: null
};
