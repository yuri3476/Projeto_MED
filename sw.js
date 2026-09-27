/**
 * sw.js
 * ---------------------------------------------------------------------------
 * Service Worker básico — existe principalmente pra deixar o app instalável
 * (ícone na tela inicial / janela própria) e carregar mais rápido em visitas
 * seguintes. NÃO tenta manter os dados funcionando offline (isso depende do
 * Firestore, que precisa de internet pra sincronizar) — só os arquivos do
 * próprio app (HTML, CSS, JS, ícones).
 *
 * Estratégia:
 *   - index.html: sempre busca da rede primeiro (você recebe a versão mais
 *     nova assim que estiver online); só usa a versão em cache se a rede
 *     falhar (por exemplo, sem internet).
 *   - CSS/JS/ícones: usa o cache primeiro (mais rápido), e atualiza o cache
 *     em segundo plano pra próxima visita.
 *
 * Toda vez que os arquivos do app mudarem de verdade, troque o número da
 * versão abaixo — isso cria um cache novo e descarta o antigo.
 * ---------------------------------------------------------------------------
 */
const CACHE_VERSION = 'revisoes-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/categories.js',
  './js/config.js',
  './js/cronograma.js',
  './js/dashboard.js',
  './js/dom.js',
  './js/dragdrop.js',
  './js/firebase-sync.js',
  './js/flashcards.js',
  './js/main.js',
  './js/modal.js',
  './js/notes.js',
  './js/search.js',
  './js/settings.js',
  './js/state.js',
  './js/sync-ui.js',
  './js/theme.js',
  './js/toast.js',
  './js/topics.js',
  './js/utils.js',
  './js/view.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if(request.method !== 'GET') return;

  // não mexe em nada que não seja do próprio app (Firebase, fontes do Google
  // etc. seguem direto pra rede, sem passar pelo cache)
  const url = new URL(request.url);
  if(url.origin !== self.location.origin) return;

  const isHtmlNavigation = request.mode === 'navigate' || url.pathname.endsWith('.html');

  if(isHtmlNavigation){
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request){
  try{
    const response = await fetch(request);
    const cache = await caches.open(CACHE_VERSION);
    cache.put(request, response.clone());
    return response;
  }catch(e){
    const cached = await caches.match(request);
    return cached || Response.error();
  }
}

async function cacheFirst(request){
  const cached = await caches.match(request);
  if(cached){
    // atualiza o cache em segundo plano pra próxima visita (não bloqueia a resposta atual)
    fetch(request).then((response) => {
      caches.open(CACHE_VERSION).then((cache) => cache.put(request, response));
    }).catch(() => {});
    return cached;
  }
  const response = await fetch(request);
  const cache = await caches.open(CACHE_VERSION);
  cache.put(request, response.clone());
  return response;
}
