/**
 * firebase-sync.js
 * ---------------------------------------------------------------------------
 * Toda a comunicação com o Firestore vive aqui: iniciar o app do Firebase,
 * assinar mudanças em tempo real (onSnapshot) e salvar (setDoc). O resto do
 * app nunca importa o SDK do Firebase diretamente — só chama as funções
 * exportadas daqui, o que deixa fácil trocar de back-end no futuro se quiser.
 * ---------------------------------------------------------------------------
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, FIRESTORE_COLLECTION, SYNC_CODE_STORAGE_KEY } from './config.js';
import { state } from './state.js';
import { showToast } from './toast.js';
import { el, setText } from './dom.js';

let db = null;
let firebaseInitError = null;

try{
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}catch(e){
  firebaseInitError = e;
  console.error('[revisões] falha ao iniciar o Firebase — confira firebaseConfig em js/config.js:', e);
}

// Callback chamado toda vez que novos dados chegam do Firestore.
// É registrado pelo main.js, que decide o que re-renderizar.
let onRemoteDataChange = () => {};
export function onSync(callback){
  onRemoteDataChange = callback;
}

function setSyncStatus(text, offline = false){
  setText('sync-status-text', text);
  const dot = el('sync-dot');
  if(dot) dot.classList.toggle('offline', !!offline);
}

export function getSavedSyncCode(){
  return localStorage.getItem(SYNC_CODE_STORAGE_KEY);
}

export function saveSyncCodeLocally(code){
  localStorage.setItem(SYNC_CODE_STORAGE_KEY, code);
}

export function generateSyncCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I para evitar confusão
  let code = '';
  for(let i = 0; i < 6; i++){
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Conecta a um "documento" do Firestore identificado pelo código de
 * sincronização e passa a escutar mudanças em tempo real.
 */
export function initSync(code){
  if(!db){
    setSyncStatus('Firebase não configurado', true);
    showToast('O Firebase não está configurado corretamente. Veja js/config.js.', 'error');
    return;
  }

  if(state.unsubscribeSnapshot){
    state.unsubscribeSnapshot();
  }

  state.currentDocRef = doc(db, FIRESTORE_COLLECTION, code);
  setText('sync-code-display', code);
  setSyncStatus('conectando...');

  state.unsubscribeSnapshot = onSnapshot(
    state.currentDocRef,
    (snapshot) => {
      const data = snapshot.data() || {};
      state.topics = Array.isArray(data.topics) ? data.topics : [];
      state.categories = Array.isArray(data.categories) ? data.categories : [];
      state.weeks = Array.isArray(data.weeks) ? data.weeks : [];

      if(state.currentWeekIndex >= state.weeks.length){
        state.currentWeekIndex = Math.max(0, state.weeks.length - 1);
      }

      setSyncStatus('sincronizado');
      onRemoteDataChange();
    },
    (error) => {
      console.error('[revisões] erro ao sincronizar com o Firestore:', error);
      setSyncStatus('erro de conexão', true);
      showToast(
        'Não foi possível conectar ao banco de dados. Verifique sua internet e se o Firestore está ativado no projeto.',
        'error'
      );
    }
  );
}

/**
 * Salva topics/categories/weeks inteiros no documento atual.
 * Toda alteração de dados no app passa por aqui.
 */
export async function persistAll(){
  if(!state.currentDocRef){
    console.warn('[revisões] tentativa de salvar sem sincronização ativa — a mudança não será salva.');
    showToast('Não é possível salvar: nenhum código de sincronização ativo.', 'error');
    return false;
  }
  try{
    await setDoc(state.currentDocRef, {
      topics: state.topics,
      categories: state.categories,
      weeks: state.weeks
    });
    return true;
  }catch(error){
    console.error('[revisões] falha ao salvar no Firestore:', error);
    setSyncStatus('falha ao salvar', true);
    showToast('Não foi possível salvar sua última alteração. Verifique sua conexão.', 'error');
    return false;
  }
}
