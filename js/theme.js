/**
 * theme.js
 * ---------------------------------------------------------------------------
 * Alterna entre tema claro e escuro. É uma preferência do aparelho/navegador
 * (guardada no localStorage), não algo sincronizado entre dispositivos —
 * assim como a maioria dos apps trata isso.
 * ---------------------------------------------------------------------------
 */

const THEME_STORAGE_KEY = 'revisoes_theme';

export function initTheme(){
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);
}

function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function toggleTheme(){
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}
