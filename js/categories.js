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

// Preenche qualquer <select> de categorias (usado no formulário de tema e no
// de questão) com as categorias atuais, mantendo o valor já selecionado
// quando possível.
export function populateCategorySelectInto(selectId){
  const select = el(selectId);
  if(!select) return;
  const previousValue = select.value;
  select.innerHTML = '<option value="">Sem categoria</option>' +
    state.categories.map(c => `<option value="${escapeAttr(c.name)}">${escapeHtml(c.name)}</option>`).join('');
  if(state.categories.some(c => c.name === previousValue)){
    select.value = previousValue;
  }
}

// Atalho para o formulário de tema, que sempre usa o mesmo id.
export function populateCategorySelect(){
  populateCategorySelectInto('f-cat');
}

export function openCategoryModal(categoryId){
  state.editingCategoryId = categoryId || null;
  const category = categoryId ? state.categories.find(c => c.id === categoryId) : null;

  state.selectedSwatch = category ? category.color : nextPaletteColor();
  const nameInput = el('f-cat-name');
  if(nameInput) nameInput.value = category ? category.name : '';

  const titleEl = document.querySelector('#cat-overlay h2');
  if(titleEl) titleEl.textContent = category ? 'Editar categoria' : 'Nova categoria';
  const saveBtn = document.querySelector('#cat-overlay .btn-primary');
  if(saveBtn) saveBtn.textContent = category ? 'Salvar alterações' : 'Criar categoria';

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
  state.editingCategoryId = null;
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

  const duplicate = state.categories.find(c =>
    c.name.toLowerCase() === name.toLowerCase() && c.id !== state.editingCategoryId
  );
  if(duplicate){
    nameInput.style.borderColor = 'var(--brick)';
    showToast('Já existe uma categoria com esse nome.', 'error');
    return;
  }

  if(state.editingCategoryId){
    const category = state.categories.find(c => c.id === state.editingCategoryId);
    if(category){
      const oldName = category.name;
      category.name = name;
      category.color = state.selectedSwatch;
      // temas e flashcards guardam o NOME da categoria, não o id — então um
      // rename precisa se propagar pra tudo que já usava o nome antigo.
      if(oldName !== name){
        state.topics.forEach(t => { if(t.cat === oldName) t.cat = name; });
        state.flashcards.forEach(c => { if(c.cat === oldName) c.cat = name; });
        if(state.currentCatFilter === oldName) state.currentCatFilter = name;
        if(state.flashcardsCatFilter === oldName) state.flashcardsCatFilter = name;
      }
    }
    await persistAll();
    closeCategoryModal();
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
  const index = state.categories.findIndex(c => c.id === id);
  if(index === -1) return;
  const category = state.categories[index];
  const confirmed = confirm(`Remover a categoria "${category.name}"? Os temas e flashcards dessa categoria não serão excluídos.`);
  if(!confirmed) return;

  state.categories.splice(index, 1);
  if(state.currentCatFilter === category.name) state.currentCatFilter = null;
  if(state.flashcardsCatFilter === category.name) state.flashcardsCatFilter = null;
  await persistAll();

  showToast(`Categoria "${category.name}" removida.`, 'info', {
    actionLabel: 'Desfazer',
    onAction: async () => {
      state.categories.splice(index, 0, category);
      await persistAll();
    }
  });
}

export function renderCategoryNav(){
  renderCategoryNavGeneric({
    navId: 'cat-nav',
    items: state.topics,
    activeFilter: state.currentCatFilter,
    onFilterFn: 'setCategoryFilter'
  });
}

/**
 * Renderiza uma lista de categorias na barra lateral, contando quantos itens
 * de `items` (temas, questões, etc.) usam cada uma. Reaproveitada pela tela
 * de Revisões e pela de Questões, que têm suas próprias contagens e filtro.
 *
 *   navId       — id do <nav> onde a lista vai ser desenhada
 *   items       — array de objetos com um campo `.cat`
 *   activeFilter— nome da categoria filtrada no momento (ou null)
 *   onFilterFn  — nome da função global (window.*) chamada ao clicar
 */
export function renderCategoryNavGeneric({ navId, items, activeFilter, onFilterFn }){
  const counts = {};
  items.forEach(item => { if(item.cat) counts[item.cat] = (counts[item.cat] || 0) + 1; });

  if(state.categories.length === 0){
    setHtml(navId, `<p style="font-size:12px;color:var(--text-muted);padding:2px 8px;margin:2px 0 0;">Nenhuma categoria ainda. Toque em + para criar.</p>`);
    return;
  }

  setHtml(navId, state.categories.map(category => `
    <div class="nav-item-wrap">
      <button class="nav-item ${activeFilter === category.name ? 'active' : ''}" onclick="${onFilterFn}('${escapeAttr(category.name)}')">
        <span class="cat-swatch" style="background:${category.color}"></span>
        <span class="nav-label">${escapeHtml(category.name)}</span>
        <span class="nav-count">${counts[category.name] || 0}</span>
      </button>
      <span class="nav-item-icons">
        <button class="nav-del" onclick="openCategoryModal('${category.id}')" title="Editar categoria">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
        </button>
        <button class="nav-del" onclick="deleteCategory('${category.id}', event)" title="Remover categoria">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </span>
    </div>
  `).join(''));
}
