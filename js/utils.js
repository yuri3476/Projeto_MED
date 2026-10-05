/**
 * utils.js
 * ---------------------------------------------------------------------------
 * Funções puras e genéricas, sem dependência de estado ou do DOM (exceto
 * `icon`, que só monta uma string de SVG). Fáceis de testar isoladamente.
 * ---------------------------------------------------------------------------
 */
import { NAV_ICON_PATHS, SCORE_INTERVALS } from './config.js';

// Datas são sempre tratadas como DIA DE CALENDÁRIO LOCAL ("2026-10-05").
// Antes isso passava por toISOString(), que converte pra UTC e, em fusos à
// frente de Londres (Portugal, Espanha, Japão...), fazia "hoje" virar "ontem".
function pad2(n){ return String(n).padStart(2, '0'); }

function toLocalISO(date){
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseISO(iso){
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(){
  return toLocalISO(new Date());
}

export function addDays(iso, days){
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
}

// Quantos dias inteiros se passaram entre duas datas ISO (pode ser negativo).
export function daysBetween(isoFrom, isoTo){
  const a = parseISO(isoFrom);
  const b = parseISO(isoTo);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
                     Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
}

export function fmtDate(iso){
  return parseISO(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
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

/* ---------------------------------------------------------------------------
   Texto formatado das anotações (negrito, itálico, marca-texto). Guardamos
   como HTML simples, então precisamos de dois cuidados:
   - saber se "está vazio" olhando só o texto, não as tags
   - limpar qualquer tag/atributo que não seja de formatação de texto, para
     não abrir brecha de segurança caso o mesmo código de sincronização seja
     usado em mais de um lugar
--------------------------------------------------------------------------- */

export function stripHtml(html){
  const container = document.createElement('div');
  container.innerHTML = html || '';
  return container.textContent || '';
}

const ALLOWED_RICH_TEXT_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'BR', 'DIV', 'P', 'UL', 'OL', 'LI']);

export function sanitizeRichText(html){
  const template = document.createElement('template');
  template.innerHTML = html || '';

  function clean(parent){
    [...parent.childNodes].forEach(node => {
      if(node.nodeType === Node.ELEMENT_NODE){
        if(!ALLOWED_RICH_TEXT_TAGS.has(node.tagName)){
          // tag não permitida: mantém o texto/filhos, descarta só a tag em si
          while(node.firstChild) parent.insertBefore(node.firstChild, node);
          parent.removeChild(node);
          return;
        }
        // remove todo atributo, exceto a cor de fundo do marca-texto
        const backgroundColor = node.style.backgroundColor;
        [...node.attributes].forEach(attr => node.removeAttribute(attr.name));
        if(backgroundColor) node.style.backgroundColor = backgroundColor;
        clean(node);
      } else if(node.nodeType !== Node.TEXT_NODE){
        parent.removeChild(node); // comentários etc.
      }
    });
  }

  clean(template.content);
  return template.innerHTML;
}
