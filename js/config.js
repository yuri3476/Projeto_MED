/**
 * config.js
 * ---------------------------------------------------------------------------
 * Configuração do projeto Firebase e constantes usadas pelo resto do app.
 * Se você precisar trocar de projeto Firebase, mexa só aqui.
 * ---------------------------------------------------------------------------
 */

export const firebaseConfig = {
  apiKey: "AIzaSyA-Dh3XDbfYDNwkAbOeAxrShON3lBbCwUA",
  authDomain: "revisoes-app-b3fba.firebaseapp.com",
  projectId: "revisoes-app-b3fba",
  storageBucket: "revisoes-app-b3fba.firebasestorage.app",
  messagingSenderId: "724390211207",
  appId: "1:724390211207:web:472ab6cb822ac1cfd41222"
};

// Coleção do Firestore onde os dados de cada código de sincronização ficam salvos.
export const FIRESTORE_COLLECTION = 'revisoes-app';

// Chave usada no localStorage para lembrar o código de sincronização neste navegador.
export const SYNC_CODE_STORAGE_KEY = 'revisoes_sync_code';

export const PRIO_WEIGHT = { altissima: 4, alta: 3, media: 2, baixa: 1 };

export const PRIO_LABEL = {
  altissima: 'Altíssima incidência',
  alta: 'Alta incidência',
  media: 'Média incidência',
  baixa: 'Baixa incidência'
};

export const PRIO_ORDER = ['altissima', 'alta', 'media', 'baixa'];

export const STATUS_TITLES = {
  todos: 'Todos os temas',
  hoje: 'Revisões de hoje',
  atrasado: 'Temas atrasados',
  emdia: 'Em dia',
  dominado: 'Temas dominados'
};

// Paleta de cores usada ao criar novas categorias (uma cor por vez, em ordem).
export const CAT_PALETTE = [
  '#4f8c5f', '#b1762f', '#5b71a0', '#b04863',
  '#3f7a93', '#8a6bab', '#c46a3f', '#5c8a72'
];

// Regra de repetição espaçada: nota obtida na revisão -> dias até a próxima.
// Percorrida em ordem; a primeira faixa cuja "min" for atingida vence.
export const SCORE_INTERVALS = [
  { min: 100, days: 30 },
  { min: 80,  days: 15 },
  { min: 70,  days: 7 },
  { min: 50,  days: 5 },
  { min: 0,   days: 2 }
];

// Quantas notas de 100% (não precisam ser seguidas) marcam um tema como Dominado.
export const MASTERY_PERFECT_SCORES_REQUIRED = 2;

// ---------------------------------------------------------------------------
// Repetição espaçada dos flashcards: algoritmo FSRS (Free Spaced Repetition
// Scheduler) — o mesmo modelo de memória (Dificuldade + Estabilidade +
// Retrievabilidade) que o Anki moderno usa, no lugar do SM-2 clássico.
//
// IMPORTANTE sobre os pesos abaixo (FSRS_WEIGHTS): são os parâmetros padrão
// publicados pelos criadores do FSRS (open-spaced-repetition/fsrs4anki),
// usados como ponto de partida — mas o próprio projeto FSRS foi desenhado
// para que cada pessoa treine pesos PRÓPRIOS a partir do seu histórico real
// de revisões (é isso que dá a ele a vantagem sobre um algoritmo genérico).
// Se você já usa o Anki com FSRS habilitado, vá em Configurações do baralho
// → FSRS → Otimizar, copie os 19 números que aparecerem, e cole aqui no
// lugar destes para ter previsões calibradas com a sua memória de verdade.
// ---------------------------------------------------------------------------
export const FSRS_WEIGHTS = [
  0.4072, 1.1829, 3.1262, 15.4722,   // w0-3: estabilidade inicial (Errei/Difícil/Bom/Fácil)
  7.2102, 0.5316,                    // w4-5: dificuldade inicial
  1.0651,                            // w6: quanto a dificuldade muda a cada revisão
  0.0234,                            // w7: força da regressão à média da dificuldade
  1.616, 0.1544, 1.0824,             // w8-10: crescimento de estabilidade ao acertar
  1.9813, 0.0953, 0.2975, 2.2042,    // w11-14: queda de estabilidade ao errar (lapso)
  0.2407,                            // w15: penalidade do "Difícil"
  2.9466,                            // w16: bônus do "Fácil"
  0.5034, 0.6567                     // w17-18: ajuste de curto prazo (não usado neste app)
];

export const FSRS_DECAY = -0.5;
export const FSRS_FACTOR = 19 / 81; // deriva de: retrievability(t=S) deve dar exatamente 0.9

// "Retenção desejada": 0.9 = revisa um pouco antes de ter 90% de chance de
// lembrar. Descer esse número espaça mais as revisões (mais esquecimento
// tolerado); subir aproxima mais as revisões (menos esquecimento).
export const FSRS_REQUEST_RETENTION = 0.9;

// Meta diária de revisões mostrada na aba de Análise (ajuste aqui se quiser
// um número diferente de "cartões por dia" como referência pessoal).
export const DAILY_REVIEW_GOAL = 50;

// Paths SVG (viewBox 0 0 24 24) reaproveitados nos ícones de navegação.
export const NAV_ICON_PATHS = {
  todos: '<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect>',
  hoje: '<circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15.5 14"></polyline>',
  atrasado: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
  emdia: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
  dominado: '<circle cx="12" cy="8" r="6"></circle><polyline points="8.2 13.7 7 22 12 19 17 22 15.8 13.7"></polyline>'
};
