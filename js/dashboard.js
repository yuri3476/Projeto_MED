/**
 * dashboard.js
 * ---------------------------------------------------------------------------
 * "Painel": uma visão única do que está pendente agora, juntando Revisões,
 * Cronograma e Flashcards num só lugar — em vez de precisar checar as três
 * telas separadamente pra saber o que fazer hoje.
 * ---------------------------------------------------------------------------
 */
import { state } from './state.js';
import { setHtml } from './dom.js';
import { statusOf } from './topics.js';
import { todayISO } from './utils.js';
import { setView } from './view.js';
import { startStudy } from './flashcards.js';
import { openCategoryModal } from './categories.js';
import { openTopicModal } from './topics.js';
import { openFlashcardModal } from './flashcards.js';

function topicsSummary(){
  const atrasados = state.topics.filter(t => statusOf(t) === 'atrasado').length;
  const hoje = state.topics.filter(t => statusOf(t) === 'hoje').length;
  return { atrasados, hoje, total: state.topics.length };
}

function cronogramaSummary(){
  let pendentes = 0;
  let total = 0;
  state.weeks.forEach(week => {
    week.tasks.forEach(task => {
      total += 1;
      if(!task.done) pendentes += 1;
    });
  });
  return { pendentes, total, semanas: state.weeks.length };
}

function flashcardsSummary(){
  const today = todayISO();
  const novos = state.flashcards.filter(c => c.status !== 'review').length;
  const paraHoje = state.flashcards.filter(c => c.status === 'review' && c.due <= today).length;
  return { novos, paraHoje, total: state.flashcards.length };
}

function goToRevisoes(){ setView('revisoes'); }
function goToCronograma(){ setView('cronograma'); }
function goToFlashcards(){ setView('flashcards'); }
function goStudyFlashcardsNow(){
  setView('flashcards');
  setTimeout(() => startStudy(), 60);
}

function isFreshAccount(){
  return state.topics.length === 0 && state.categories.length === 0
    && state.flashcards.length === 0 && state.weeks.length === 0;
}

function startFirstCategory(){
  setView('revisoes');
  setTimeout(() => openCategoryModal(), 60);
}
function startFirstTopic(){
  setView('revisoes');
  setTimeout(() => openTopicModal(), 60);
}
function startFirstFlashcard(){
  setView('flashcards');
  setTimeout(() => openFlashcardModal(), 60);
}

function welcomeCardHtml(){
  return `
    <div class="dash-welcome">
      <strong>Bem-vindo(a) ao seu painel de estudos 👋</strong>
      <p>Ainda não há nada por aqui — comece criando uma categoria pra organizar seus assuntos, depois seu primeiro tema de revisão ou flashcard.</p>
      <div class="dash-welcome-actions">
        <button class="btn-primary" onclick="startFirstCategory()">Criar minha primeira categoria</button>
        <button class="btn-secondary" onclick="startFirstTopic()">Criar meu primeiro tema</button>
        <button class="btn-secondary" onclick="startFirstFlashcard()">Criar meu primeiro flashcard</button>
      </div>
    </div>
  `;
}

function dashboardCard({ title, big, bigLabel, lines, actionLabel, onAction, accent }){
  return `
    <div class="dash-card">
      <div class="dash-card-top">
        <span class="dash-card-title">${title}</span>
        <span class="dash-card-accent" style="background:${accent}"></span>
      </div>
      <div class="dash-card-big">${big}</div>
      <div class="dash-card-big-label">${bigLabel}</div>
      <div class="dash-card-lines">${lines.map(l => `<span>${l}</span>`).join('')}</div>
      <button class="btn-secondary dash-card-btn" onclick="${onAction}">${actionLabel}</button>
    </div>
  `;
}

export function renderDashboard(){
  if(isFreshAccount()){
    setHtml('dashboard-summary', 'Vamos começar.');
    setHtml('dashboard-cards', welcomeCardHtml());
    return;
  }

  const topics = topicsSummary();
  const cron = cronogramaSummary();
  const cards = flashcardsSummary();

  const totalPendenteHoje = topics.atrasados + topics.hoje + cron.pendentes + cards.novos + cards.paraHoje;

  setHtml('dashboard-summary', totalPendenteHoje === 0
    ? 'Tudo em dia por aqui — nada pendente no momento. 🎉'
    : `Você tem <strong>${totalPendenteHoje}</strong> ${totalPendenteHoje === 1 ? 'pendência' : 'pendências'} no total, somando as três áreas.`
  );

  setHtml('dashboard-cards', [
    dashboardCard({
      title: 'Revisões',
      big: topics.atrasados + topics.hoje,
      bigLabel: 'temas pendentes',
      lines: [
        `${topics.atrasados} atrasado${topics.atrasados === 1 ? '' : 's'}`,
        `${topics.hoje} para hoje`,
        `${topics.total} no total`
      ],
      actionLabel: 'Ver temas',
      onAction: 'goToRevisoes()',
      accent: 'var(--sage)'
    }),
    dashboardCard({
      title: 'Cronograma',
      big: cron.pendentes,
      bigLabel: 'tarefas a fazer',
      lines: [
        `${cron.semanas} semana${cron.semanas === 1 ? '' : 's'} criada${cron.semanas === 1 ? '' : 's'}`,
        `${cron.total} tarefas no total`
      ],
      actionLabel: 'Ver cronograma',
      onAction: 'goToCronograma()',
      accent: 'var(--gold)'
    }),
    dashboardCard({
      title: 'Flashcards',
      big: cards.novos + cards.paraHoje,
      bigLabel: 'para estudar agora',
      lines: [
        `${cards.novos} novo${cards.novos === 1 ? '' : 's'}`,
        `${cards.paraHoje} para hoje`,
        `${cards.total} no total`
      ],
      actionLabel: (cards.novos + cards.paraHoje) > 0 ? 'Estudar agora' : 'Ver flashcards',
      onAction: (cards.novos + cards.paraHoje) > 0 ? 'goStudyFlashcardsNow()' : 'goToFlashcards()',
      accent: 'var(--teal)'
    })
  ].join(''));
}

export { goToRevisoes, goToCronograma, goToFlashcards, goStudyFlashcardsNow, startFirstCategory, startFirstTopic, startFirstFlashcard };
