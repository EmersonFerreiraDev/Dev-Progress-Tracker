/* ─────────────────────────────────────────────────────
   main.js — O Maestro (Ponto de Entrada)
───────────────────────────────────────────────────── */
import { loadState, saveState, defaultState } from './state.js';
import { todayStr, calcGlobalProgress, genSubId } from './utils.js';
import { renderAll, openModal, closeAllModals, announce } from './ui.js';

// 1. ESTADO GLOBAL
let appState = loadState();
let editingTopicId = null;
let addingSubtopicToId = null;

// 2. FUNÇÃO DE ATUALIZAÇÃO GERAL
// Sempre que algo mudar nos dados, chamamos essa função
function updateUI() {
  const globalPct = calcGlobalProgress(appState.topics);
  renderAll({ ...appState, globalPct });
}

// 3. HANDLERS (Ações do Usuário)
function handleCheckboxChange(checkbox) {
  const topicId = parseInt(checkbox.dataset.topicId);
  const subId = checkbox.dataset.subtopicId;
  
  const topic = appState.topics.find(t => t.id === topicId);
  const sub = topic?.subtopics.find(s => s.id === subId);
  
  if (sub) {
    sub.done = checkbox.checked;
    saveState(appState);
    updateUI();
    announce(`${sub.text}: ${sub.done ? 'concluído' : 'pendente'}`);
  }
}

function handleAddTopic() {
  const input = document.getElementById('input-topic-name');
  const name = input?.value.trim();
  if (!name) return;

  appState.topics.push({ id: appState.nextTopicId++, title: name, subtopics: [] });
  saveState(appState);
  closeAllModals();
  updateUI();
}

// 4. EVENT DELEGATION (Ouvindo cliques no documento)
function bindEvents() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const target = btn.dataset.target;

    if (action === 'add-topic') openModal('modal-topic');
    if (action === 'confirm-topic') handleAddTopic();
    if (action === 'close-modal') closeAllModals();
    
    // Streak
    if (action === 'log-today') {
      const today = todayStr();
      if (appState.streak.lastStudyDate !== today) {
        appState.streak.count++;
        appState.streak.lastStudyDate = today;
        saveState(appState);
        updateUI();
      }
    }
  });

  // Checkboxes
  document.getElementById('topics-list')?.addEventListener('change', e => {
    if (e.target.classList.contains('subtopic-check')) {
      handleCheckboxChange(e.target);
    }
  });

  // ESC para fechar modais
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllModals();
  });
}

// 5. INIT
function init() {
  updateUI();
  bindEvents();
  console.log('🚀 Dev Xodozada Modularizado!');
}

init();