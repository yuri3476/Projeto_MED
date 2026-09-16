/**
 * dom.js
 * ---------------------------------------------------------------------------
 * Pequeno helper para buscar elementos do DOM com aviso no console quando
 * algo não é encontrado — ajuda a detectar rapidamente um id errado no HTML
 * ou no JS, em vez de falhar silenciosamente ou quebrar com um erro confuso.
 * ---------------------------------------------------------------------------
 */

export function el(id){
  const node = document.getElementById(id);
  if(!node){
    console.warn(`[revisões] elemento #${id} não foi encontrado no HTML.`);
  }
  return node;
}

export function setText(id, text){
  const node = el(id);
  if(node) node.textContent = text;
}

export function setHtml(id, html){
  const node = el(id);
  if(node) node.innerHTML = html;
}

export function setDisplay(id, visible){
  const node = el(id);
  if(node) node.style.display = visible ? '' : 'none';
}
