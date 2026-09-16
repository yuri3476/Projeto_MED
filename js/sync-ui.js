/**
 * sync-ui.js
 * ---------------------------------------------------------------------------
 * Interface do modal de "código de sincronização" (criar código novo, usar
 * um código existente, copiar o código atual). A lógica de conexão em si
 * com o Firestore vive em firebase-sync.js — aqui é só a tela.
 * ---------------------------------------------------------------------------
 */
import { el } from './dom.js';
import { openOverlay, closeOverlay } from './modal.js';
import { initSync, generateSyncCode, saveSyncCodeLocally, getSavedSyncCode } from './firebase-sync.js';
import { showToast } from './toast.js';

function revealCancelButton(){
  const cancelBtn = el('sync-cancel-btn');
  if(cancelBtn) cancelBtn.style.display = '';
}

export function createNewSyncCode(){
  const code = generateSyncCode();
  saveSyncCodeLocally(code);
  closeOverlay('sync-overlay');
  revealCancelButton();
  initSync(code);
}

export function useEnteredSyncCode(){
  const input = el('f-sync-code');
  if(!input) return;
  const code = input.value.trim().toUpperCase();
  if(!code){
    showToast('Digite um código válido.', 'error');
    return;
  }
  saveSyncCodeLocally(code);
  closeOverlay('sync-overlay');
  revealCancelButton();
  initSync(code);
}

export function openSyncSettings(){
  const input = el('f-sync-code');
  if(input) input.value = getSavedSyncCode() || '';
  openOverlay('sync-overlay');
}

export function closeSyncModal(){
  closeOverlay('sync-overlay');
}

export function copySyncCode(){
  const code = getSavedSyncCode();
  if(!code) return;
  navigator.clipboard.writeText(code).then(() => {
    const btn = el('copy-code-btn');
    if(!btn) return;
    const original = btn.textContent;
    btn.textContent = 'Copiado!';
    setTimeout(() => { btn.textContent = original; }, 1500);
  }).catch(() => {
    showToast('Não foi possível copiar o código automaticamente. Copie manualmente.', 'error');
  });
}
