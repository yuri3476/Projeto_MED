/**
 * utils.js
 * ---------------------------------------------------------------------------
 * Funções puras e genéricas, sem dependência de estado ou do DOM (exceto
 * `icon`, que só monta uma string de SVG). Fáceis de testar isoladamente.
 * ---------------------------------------------------------------------------
 */
import { NAV_ICON_PATHS, SCORE_INTERVALS } from './config.js';

export function todayISO(){
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function addDays(iso, days){
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(iso){
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Dada uma nota de 0 a 100, devolve em quantos dias a próxima revisão deve ocorrer.
export function intervalForScore(score){
  const match = SCORE_INTERVALS.find(range => score >= range.min);
  return match ? match.days : SCORE_INTERVALS[SCORE_INTERVALS.length - 1].days;
}

export function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

// Usado ao interpolar strings dentro de atributos onclick="...('valor')".
export function escapeAttr(value){
  return String(value ?? '').replace(/'/g, "\\'");
}

export function icon(name, extraClass = ''){
  const path = NAV_ICON_PATHS[name] || '';
  return `<svg class="icon nav-icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

export function randomId(prefix){
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
}
