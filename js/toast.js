/**
 * toast.js
 * ---------------------------------------------------------------------------
 * Pequenas notificações no canto da tela — erros, confirmações, e avisos com
 * um botão de ação (usado pelo "Desfazer" ao excluir algo). Usa classes CSS
 * (definidas em styles.css) em vez de estilos inline, pra poder ajustar o
 * visual e o comportamento em telas pequenas num só lugar.
 * ---------------------------------------------------------------------------
 */

let container = null;

function getContainer(){
  if(container) return container;
  container = document.createElement('div');
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

/**
 * showToast(message, type, options)
 *   type: 'info' | 'success' | 'error'
 *   options.durationMs: quanto tempo até sumir sozinho (padrão 4500ms;
 *     6500ms quando há um botão de ação, pra dar tempo de clicar)
 *   options.actionLabel / options.onAction: texto e função do botão (ex.: "Desfazer")
 */
export function showToast(message, type = 'info', options = {}){
  const { actionLabel, onAction, durationMs } = options;
  const duration = durationMs || (actionLabel ? 6500 : 4500);

  const node = document.createElement('div');
  node.className = `toast toast-${type}`;
  node.setAttribute('role', 'status');

  const text = document.createElement('span');
  text.className = 'toast-text';
  text.textContent = message;
  node.appendChild(text);

  let dismissed = false;
  function dismiss(){
    if(dismissed) return;
    dismissed = true;
    node.classList.remove('toast-in');
    setTimeout(() => node.remove(), 250);
  }

  if(actionLabel && onAction){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = actionLabel;
    btn.onclick = () => { onAction(); dismiss(); };
    node.appendChild(btn);
  }

  getContainer().appendChild(node);
  requestAnimationFrame(() => node.classList.add('toast-in'));
  setTimeout(dismiss, duration);
}
