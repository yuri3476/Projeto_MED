/**
 * categories.js
 * ---------------------------------------------------------------------------
 * Tudo relacionado a categorias: criar, listar na barra lateral, excluir,
 * e popular o <select> de categorias usado no formulário de tema.
 * ---------------------------------------------------------------------------
 */
import { state } from './state.js';
import { CAT_PALETTE } from './config.js';
import { escapeHtml, escapeAttr } from './utils.js';
import { el, setHtml } from './dom.js';
import { openOverlay, closeOverlay } from './modal.js';
import { persistAll } from './firebase-sync.js';
import { showToast } from './toast.js';

const DEFAULT_CATEGORY_COLOR = '#8a8478';

export function colorForCategory(name){
  const found = state.categories.find(c => c.name === name);
  return found ? found.color : DEFAULT_CATEGORY_COLOR;
}

function nextPaletteColor(){
  const usedColors = state.categories.map(c => c.color);
  const freeColor = CAT_PALETTE.find(c => !usedColors.includes(c));
  return freeColor || CAT_PALETTE[state.categories.length % CAT_PALETTE.length];
}

// Preenche o <select id="f-cat"> do formulário de tema com as categorias atuais.
export function populateCategorySelect(){
  const select = el('f-cat');
  if(!select) return;
  const previousValue = select.value;
  select.innerHTML = '<option value="">Sem categoria</option>' +
    state.categories.map(c => `<option value="${escapeAttr(c.name)}">${escapeHtml(c.name)}</option>`).join('');
  if(state.categories.some(c => c.name === previousValue)){
    select.value = previousValue;
  }
}

export function openCategoryModal(){
  state.selectedSwatch = nextPaletteColor();
  const nameInput = el('f-cat-name');
  if(nameInput) nameInput.value = '';

  const picker = el('swatch-picker');
  if(picker){
    picker.innerHTML = CAT_PALETTE.map(color => `
      <span class="swatch ${color === state.selectedSwatch ? 'selected' : ''}"
            data-color="${color}" style="background:${color}"
            onclick="pickCategorySwatch('${color}')"></span>
    `).join('');
  }

  openOverlay('cat-overlay');
  setTimeout(() => nameInput && nameInput.focus(), 50);
}

export function closeCategoryModal(){
  closeOverlay('cat-overlay');
}

export function pickCategorySwatch(color){
  state.selectedSwatch = color;
  document.querySelectorAll('#swatch-picker .swatch').forEach(swatch => {
    swatch.classList.toggle('selected', swatch.dataset.color === color);
  });
}

// Recebe o id do <select id="f-cat"> do formulário de tema aberto, se houver,
// para já pré-selecionar a categoria recém-criada assim que ela existir.
export async function saveCategory(onCreated){
  const nameInput = el('f-cat-name');
  if(!nameInput) return;
  const name = nameInput.value.trim();
  if(!name) return;

  if(state.categories.some(c => c.name.toLowerCase() === name.toLowerCase())){
    nameInput.style.borderColor = 'var(--brick)';
    showToast('Já existe uma categoria com esse nome.', 'error');
    return;
  }

  state.categories.push({
    id: 'c' + Date.now() + Math.random().toString(36).slice(2, 6),
    name,
    color: state.selectedSwatch
  });

  const ok = await persistAll();
  closeCategoryModal();
  if(ok && typeof onCreated === 'function') onCreated(name);
}

export async function deleteCategory(id, event){
  if(event) event.stopPropagation();
  const category = state.categories.find(c => c.id === id);
  if(!category) return;
  const confirmed = confirm(`Remover a categoria "${category.name}"? Os temas dessa categoria não serão excluídos.`);
  if(!confirmed) return;

  state.categories = state.categories.filter(c => c.id !== id);
  if(state.currentCatFilter === category.name) state.currentCatFilter = null;
  await persistAll();
}

export function renderCategoryNav(){
  const catCounts = {};
  state.topics.forEach(t => { if(t.cat) catCounts[t.cat] = (catCounts[t.cat] || 0) + 1; });

  if(state.categories.length === 0){
    setHtml('cat-nav', `<p style="font-size:12px;color:var(--text-muted);padding:2px 8px;margin:2px 0 0;">Nenhuma categoria ainda. Toque em + para criar.</p>`);
    return;
  }

  setHtml('cat-nav', state.categories.map(category => `
    <div class="nav-item-wrap">
      <button class="nav-item ${state.currentCatFilter === category.name ? 'active' : ''}" onclick="setCategoryFilter('${escapeAttr(category.name)}')">
        <span class="cat-swatch" style="background:${category.color}"></span>
        <span class="nav-label">${escapeHtml(category.name)}</span>
        <span class="nav-count">${catCounts[category.name] || 0}</span>
      </button>
      <button class="nav-del" onclick="deleteCategory('${category.id}', event)" title="Remover categoria">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  `).join(''));
}
