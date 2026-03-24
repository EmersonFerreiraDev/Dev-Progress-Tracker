import { loadState, saveState, defaultState, removeSubtopic } from './state.js';
import { calcTopicProgress, calcGlobalProgress, genSubId, todayStr } from './utils.js';
import {
  renderAll,
  patchTopicProgress,
  patchHeader,
  patchStats,
  patchTopicTitle,
  patchStreak,
  patchAvatar,
  patchDonut,
  patchGlobalCount,
  addTopicCard,
  removeTopicCard,
  addSubtopicItem,
  openModal,
  closeModal,
  closeAllModals,
  announce,
} from './ui.js';

let state          = defaultState();
let editingTopicId = null;
let addingSubToId  = null;

function refreshStats() {
  let done = 0, pending = 0;
  state.topics.forEach(topic => {
    const { pct } = calcTopicProgress(topic);
    pct === 100 && topic.subtopics.length > 0 ? done++ : pending++;
  });
  patchStats(done, pending);
  patchGlobalCount(state);
}

function patchCardWire(topicId, pct) {
  const card = document.getElementById(`topic-${topicId}`);
  if (!card) return;
  card.style.setProperty('--topic-pct', `${pct}%`);
  card.classList.toggle('is-complete', pct === 100);
}

/* ── CHECKBOX ── */
function handleCheckboxChange(checkbox) {
  const topicId    = parseInt(checkbox.dataset.topicId);
  const subtopicId = checkbox.dataset.subtopicId;
  const topic      = state.topics.find(t => t.id === topicId);
  const subtopic   = topic?.subtopics.find(s => s.id === subtopicId);
  if (!subtopic) return;

  subtopic.done = checkbox.checked;
  saveState(state);

  const { done, total, pct } = calcTopicProgress(topic);
  patchTopicProgress(topicId, done, total, pct);
  patchCardWire(topicId, pct);
  patchHeader(calcGlobalProgress(state.topics));
  refreshStats();

  announce(`${subtopic.text}: ${checkbox.checked ? 'concluído' : 'pendente'}`);
}

/* ── TÓPICOS ── */
function handleAddTopic() {
  editingTopicId = null;
  const titleEl   = document.getElementById('modal-topic-title');
  const confirmEl = document.getElementById('btn-modal-topic-confirm');
  if (titleEl)   titleEl.textContent   = 'Novo Tópico';
  if (confirmEl) confirmEl.textContent = 'Criar';
  openModal('modal-topic');
}

function handleEditTopic(targetId) {
  const topicId = parseInt(targetId.replace('topic-', ''));
  const topic   = state.topics.find(t => t.id === topicId);
  if (!topic) return;
  editingTopicId = topicId;
  const titleEl   = document.getElementById('modal-topic-title');
  const confirmEl = document.getElementById('btn-modal-topic-confirm');
  const inputEl   = document.getElementById('input-topic-name');
  if (titleEl)   titleEl.textContent   = 'Editar Tópico';
  if (confirmEl) confirmEl.textContent = 'Salvar';
  if (inputEl)   inputEl.value         = topic.title;
  openModal('modal-topic');
  if (inputEl) setTimeout(() => { inputEl.focus(); inputEl.select(); }, 80);
}

function handleConfirmTopic() {
  const inputEl = document.getElementById('input-topic-name');
  const name    = inputEl?.value.trim() ?? '';
  if (!name) {
    if (inputEl) {
      inputEl.focus();
      inputEl.style.borderColor = '#cc0000';
      setTimeout(() => inputEl.style.borderColor = '', 1500);
    }
    return;
  }
  if (editingTopicId !== null) {
    const topic = state.topics.find(t => t.id === editingTopicId);
    if (topic) { topic.title = name; patchTopicTitle(editingTopicId, name); announce(`Tópico renomeado.`); }
  } else {
    const newTopic = { id: state.nextTopicId++, title: name, subtopics: [] };
    state.topics.push(newTopic);
    addTopicCard(newTopic);
    refreshStats();
    patchHeader(calcGlobalProgress(state.topics));
    announce(`Tópico "${name}" criado.`);
  }
  saveState(state);
  closeModal('modal-topic');
}

function handleRemoveTopic(targetId) {
  const topicId = parseInt(targetId.replace('topic-', ''));
  const topic   = state.topics.find(t => t.id === topicId);
  if (!topic) return;
  if (!confirm(`Remover "${topic.title}"?`)) return;
  state.topics = state.topics.filter(t => t.id !== topicId);
  saveState(state);
  removeTopicCard(topicId);
  setTimeout(() => {
    refreshStats();
    patchHeader(calcGlobalProgress(state.topics));
  }, 180);
  announce(`Tópico "${topic.title}" removido.`);
}

/* ── SUBTÓPICOS ── */
function handleAddSubtopic(targetId) {
  const topicId = parseInt(targetId.replace('topic-', ''));
  const topic   = state.topics.find(t => t.id === topicId);
  if (!topic) return;
  addingSubToId = topicId;
  const titleEl = document.getElementById('modal-subtopic-title');
  if (titleEl) titleEl.textContent = `Subtópico em "${topic.title}"`;
  openModal('modal-subtopic');
}

function handleConfirmSubtopic() {
  const inputEl = document.getElementById('input-subtopic-name');
  const name    = inputEl?.value.trim() ?? '';
  if (!name) {
    if (inputEl) {
      inputEl.focus();
      inputEl.style.borderColor = '#cc0000';
      setTimeout(() => inputEl.style.borderColor = '', 1500);
    }
    return;
  }
  const topic = state.topics.find(t => t.id === addingSubToId);
  if (!topic) return;
  const newSub = { id: genSubId(topic.id), text: name, done: false };
  topic.subtopics.push(newSub);
  saveState(state);
  addSubtopicItem(topic.id, newSub);
  const { done, total, pct } = calcTopicProgress(topic);
  patchTopicProgress(topic.id, done, total, pct);
  patchCardWire(topic.id, pct);
  patchHeader(calcGlobalProgress(state.topics));
  refreshStats();
  closeModal('modal-subtopic');
  announce(`Subtópico "${name}" adicionado.`);
}

function handleRemoveSubtopic(btn) {
  const topicId    = parseInt(btn.dataset.topicId);
  const subtopicId = btn.dataset.subtopicId;
  const topic      = removeSubtopic(state, topicId, subtopicId);
  if (!topic) return;
  document.getElementById(`sub-${subtopicId}`)?.remove();
  const { done, total, pct } = calcTopicProgress(topic);
  patchTopicProgress(topicId, done, total, pct);
  patchCardWire(topicId, pct);
  patchHeader(calcGlobalProgress(state.topics));
  refreshStats();
  announce('Subtópico removido.');
}

/* ── STREAK ── */
function handleLogToday() {
  const today  = todayStr();
  const streak = state.streak;
  if (streak.lastStudyDate === today) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  streak.count = streak.lastStudyDate === yesterdayStr ? streak.count + 1 : 1;
  streak.lastStudyDate = today;
  if (!streak.history.includes(today)) {
    streak.history.push(today);
    if (streak.history.length > 30) streak.history.shift();
  }
  saveState(state);
  patchStreak(streak, today);
  announce(`Estudo registrado! Streak: ${streak.count} dias.`);
}

/* ── AVATAR ── */
function handleSetAvatarUrl() {
  const inputEl = document.getElementById('input-avatar-url');
  if (inputEl && state.avatar?.startsWith('http')) inputEl.value = state.avatar;
  openModal('modal-avatar-url');
}

function handleConfirmAvatarUrl() {
  const inputEl = document.getElementById('input-avatar-url');
  const url     = inputEl?.value.trim() ?? '';
  if (!url) { inputEl?.focus(); return; }
  state.avatar = url;
  saveState(state);
  closeModal('modal-avatar-url');
  patchAvatar(state.avatar);
  announce('Imagem motivacional atualizada.');
}

function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader  = new FileReader();
  reader.onload = ev => {
    state.avatar = ev.target.result;
    saveState(state);
    patchAvatar(state.avatar);
    announce('Imagem carregada.');
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

/* ── ATALHOS DE TECLADO ── */
function bindKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    /* Ignora quando modal aberto ou input focado */
    const modalOpen  = [...document.querySelectorAll('.modal-overlay')].some(m => !m.classList.contains('hidden'));
    const inputFocus = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
    if (modalOpen || inputFocus) return;

    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); handleAddTopic(); }
    if (e.key === '?')                  { e.preventDefault(); toggleShortcutsPanel(); }
  });
}

function toggleShortcutsPanel() {
  let panel = document.getElementById('shortcuts-panel');
  if (panel) { panel.remove(); return; }
  panel = document.createElement('div');
  panel.id = 'shortcuts-panel';
  panel.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:999;
    background:#0d0d0d; border:1px solid #333; border-radius:2px;
    padding:16px 20px; font-size:0.68rem; color:#888;
    line-height:2; min-width:200px;
  `;
  panel.innerHTML = `
    <div style="color:#eee;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;font-size:0.6rem;">Atalhos</div>
    <div><kbd style="color:#eee">N</kbd> &nbsp; Novo tópico</div>
    <div><kbd style="color:#eee">Esc</kbd> &nbsp; Fechar modal</div>
    <div><kbd style="color:#eee">?</kbd> &nbsp; Fechar esta ajuda</div>
  `;
  document.body.appendChild(panel);
}

/* ── EVENTOS ── */
function bindEvents() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const target = btn.dataset.target;
    switch (action) {
      case 'add-topic':          handleAddTopic();              break;
      case 'edit-topic':         handleEditTopic(target);       break;
      case 'remove-topic':       handleRemoveTopic(target);     break;
      case 'add-subtopic':       handleAddSubtopic(target);     break;
      case 'remove-subtopic':    handleRemoveSubtopic(btn);     break;
      case 'confirm-topic':      handleConfirmTopic();          break;
      case 'confirm-subtopic':   handleConfirmSubtopic();       break;
      case 'confirm-avatar-url': handleConfirmAvatarUrl();      break;
      case 'close-modal':        closeModal(target);            break;
      case 'log-today':          handleLogToday();              break;
      case 'set-avatar-url':     handleSetAvatarUrl();          break;
    }
  });

  document.getElementById('topics-list')
    ?.addEventListener('change', e => {
      if (e.target.classList.contains('subtopic-check')) handleCheckboxChange(e.target);
    }, { passive: true });

  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) closeAllModals();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllModals();
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const modal = document.activeElement?.closest?.('.modal-overlay');
    if (!modal) return;
    if (modal.id === 'modal-topic')      handleConfirmTopic();
    if (modal.id === 'modal-subtopic')   handleConfirmSubtopic();
    if (modal.id === 'modal-avatar-url') handleConfirmAvatarUrl();
  });

  document.getElementById('avatar-file-input')
    ?.addEventListener('change', handleAvatarUpload);

  bindKeyboardShortcuts();
}

/* ── INIT ── */
function init() {
  state = loadState();
  state.globalPct = calcGlobalProgress(state.topics);
  renderAll(state);
  state.topics.forEach(topic => {
    const { pct } = calcTopicProgress(topic);
    patchCardWire(topic.id, pct);
  });
  bindEvents();
  console.log('[Dev Xodozada] 魂 App iniciado.', state);
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();