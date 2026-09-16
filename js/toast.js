/**
 * toast.js
 * ---------------------------------------------------------------------------
 * Pequenas notificações no canto da tela para erros e confirmações — em vez
 * de falhas silenciosas (que só apareceriam no console), o usuário vê
 * imediatamente quando algo deu errado, como uma falha ao salvar.
 * ---------------------------------------------------------------------------
 */

const STYLES = {
  error:   { bg: '#f7e6e1', text: '#b1503a', border: '#e3c3ba' },
  success: { bg: '#e7f0e8', text: '#4f8c5f', border: '#c9dccb' },
  info:    { bg: '#f1efe8', text: '#2c2a26', border: '#e2e0d3' }
};

let container = null;

function getContainer(){
  if(container) return container;
  container = document.createElement('div');
  container.id = 'toast-container';
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '200',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxWidth: '320px'
  });
  document.body.appendChild(container);
  return container;
}

export function showToast(message, type = 'info', durationMs = 4500){
  const palette = STYLES[type] || STYLES.info;
  const node = document.createElement('div');
  node.textContent = message;
  node.setAttribute('role', 'status');
  Object.assign(node.style, {
    background: palette.bg,
    color: palette.text,
    border: `1px solid ${palette.border}`,
    padding: '11px 15px',
    borderRadius: '9px',
    fontFamily: "'Inter', sans-serif",
    fontSize: '13px',
    lineHeight: '1.4',
    boxShadow: '0 6px 18px rgba(40,35,25,0.14)',
    opacity: '0',
    transform: 'translateY(6px)',
    transition: 'opacity .2s, transform .2s'
  });
  getContainer().appendChild(node);

  // força o navegador a aplicar o estado inicial antes de animar a entrada
  requestAnimationFrame(() => {
    node.style.opacity = '1';
    node.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transform = 'translateY(6px)';
    setTimeout(() => node.remove(), 250);
  }, durationMs);
}
