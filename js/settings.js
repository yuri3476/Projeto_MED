/**
 * settings.js
 * ---------------------------------------------------------------------------
 * Tela de Configurações: meta diária de flashcards, retenção desejada do
 * FSRS, os 19 pesos do algoritmo (com botão pra restaurar o padrão), e
 * exportar um backup de tudo em JSON.
 * ---------------------------------------------------------------------------
 */
import { state } from './state.js';
import { FSRS_WEIGHTS, DAILY_REVIEW_GOAL, FSRS_REQUEST_RETENTION } from './config.js';
import { el } from './dom.js';
import { openOverlay, closeOverlay } from './modal.js';
import { persistAll } from './firebase-sync.js';
import { showToast } from './toast.js';

export function openSettingsModal(){
  const goalInput = el('f-settings-goal');
  const retentionInput = el('f-settings-retention');
  const weightsInput = el('f-settings-weights');

  if(goalInput) goalInput.value = state.settings.dailyGoal;
  if(retentionInput) retentionInput.value = Math.round(state.settings.fsrsRetention * 100);
  if(weightsInput) weightsInput.value = state.settings.fsrsWeights.join(', ');

  openOverlay('settings-overlay');
}

export function closeSettingsModal(){
  closeOverlay('settings-overlay');
}

export function resetFsrsWeights(){
  const weightsInput = el('f-settings-weights');
  if(weightsInput) weightsInput.value = FSRS_WEIGHTS.join(', ');
  showToast('Pesos restaurados para o padrão publicado do FSRS (ainda não salvo).', 'info');
}

export async function saveSettings(){
  const goalInput = el('f-settings-goal');
  const retentionInput = el('f-settings-retention');
  const weightsInput = el('f-settings-weights');

  const goal = Number(goalInput?.value);
  if(!Number.isFinite(goal) || goal < 1){
    showToast('A meta diária precisa ser um número maior que 0.', 'error');
    return;
  }

  const retentionPct = Number(retentionInput?.value);
  if(!Number.isFinite(retentionPct) || retentionPct < 70 || retentionPct > 99){
    showToast('A retenção precisa ser um número entre 70 e 99 (%).', 'error');
    return;
  }

  const rawWeights = (weightsInput?.value || '')
    .split(',')
    .map(v => Number(v.trim()))
    .filter(v => v !== '');

  if(rawWeights.length !== 19 || rawWeights.some(v => Number.isNaN(v))){
    showToast('Os pesos do FSRS precisam ser exatamente 19 números separados por vírgula.', 'error');
    return;
  }

  state.settings = {
    dailyGoal: Math.round(goal),
    fsrsRetention: retentionPct / 100,
    fsrsWeights: rawWeights
  };

  await persistAll();
  closeSettingsModal();
  showToast('Configurações salvas.', 'success');
}

export function restoreDefaultSettings(){
  const goalInput = el('f-settings-goal');
  const retentionInput = el('f-settings-retention');
  const weightsInput = el('f-settings-weights');
  if(goalInput) goalInput.value = DAILY_REVIEW_GOAL;
  if(retentionInput) retentionInput.value = Math.round(FSRS_REQUEST_RETENTION * 100);
  if(weightsInput) weightsInput.value = FSRS_WEIGHTS.join(', ');
}

/* ---------------------------------------------------------------------------
   Exportar um backup de tudo (temas, categorias, semanas, flashcards,
   estatísticas e configurações) num único arquivo JSON — pra ter uma cópia
   fora do Firebase, ou levar os dados pra outro lugar se precisar.
--------------------------------------------------------------------------- */
export function exportBackup(){
  const backup = {
    exportedAt: new Date().toISOString(),
    topics: state.topics,
    categories: state.categories,
    weeks: state.weeks,
    flashcards: state.flashcards,
    flashcardStats: state.flashcardStats,
    dailyStats: state.dailyStats,
    streak: state.streak,
    settings: state.settings
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `revisoes-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  showToast('Backup baixado com sucesso.', 'success');
}
