/**
 * modal.js
 * ---------------------------------------------------------------------------
 * Helpers genéricos para abrir/fechar os modais (overlays). Todos os modais
 * do app seguem o mesmo padrão (classe .overlay + .open), então essa lógica
 * fica escrita uma única vez em vez de repetida em cada módulo de feature.
 * ---------------------------------------------------------------------------
 */
import { el } from './dom.js';

export function openOverlay(id){
  const overlay = el(id);
  if(overlay) overlay.classList.add('open');
}

export function closeOverlay(id){
  const overlay = el(id);
  if(overlay) overlay.classList.remove('open');
}

export function isOverlayOpen(id){
  const overlay = document.getElementById(id);
  return !!(overlay && overlay.classList.contains('open'));
}

// Fecha o modal quando o usuário clica no fundo escurecido (fora do card).
export function wireOverlayBackdropDismiss(id, onClose){
  const overlay = el(id);
  if(!overlay) return;
  overlay.addEventListener('click', (event) => {
    if(event.target === overlay) onClose();
  });
}
