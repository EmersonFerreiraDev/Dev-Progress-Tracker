/* ─────────────────────────────────────────────────────
   main.js — Controlador Principal da Aplicação
   
   RESPONSABILIDADES DESTE ARQUIVO:
   ┌─ init()          → carrega dados e renderiza uma única vez
   ├─ bindEvents()    → UM listener por tipo de evento (delegação)
   └─ handlers___()   → funções que orquestram state + ui
   
   FLUXO DE DADOS (sempre nesta ordem):
   Usuário age → handler → state (dado muda) → ui patch (tela muda)
   
   NUNCA chame ui.renderAll() fora do init().
   Para qualquer interação use as funções ui.patch___ ou ui.add/remove.
───────────────────────────────────────────────────── */

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
  addTopicCard,
  removeTopicCard,
  addSubtopicItem,
  openModal,
  closeModal,
  closeAllModals,
  announce,
} from './ui.js';


/* ─────────────────────────────────────────────────────
   ESTADO GLOBAL DO MÓDULO
───────────────────────────────────────────────────── */

/** O appState vivo durante a sessão. Carregado no init(). */
let state = defaultState();

/**
 * Guarda o ID do tópico sendo editado.
 * null = modal está em modo de CRIAÇÃO
 * número = modal está em modo de EDIÇÃO
 */
let editingTopicId = null;

/**
 * Guarda o ID do tópico que receberá um novo subtópico.
 * Preenchido quando o usuário clica em "+ Adicionar subtópico".
 */
let addingSubToId = null;


/* ─────────────────────────────────────────────────────
   UTILITÁRIO INTERNO
───────────────────────────────────────────────────── */

/**
 * Recalcula os contadores da sidebar e o donut chart.
 * Chamada após qualquer mudança que afete o status dos tópicos.
 */
function refreshStats() {
  let done = 0;
  let pending = 0;

  state.topics.forEach(topic => {
    const { pct } = calcTopicProgress(topic);
    pct === 100 && topic.subtopics.length > 0 ? done++ : pending++;
  });

  patchStats(done, pending);
}


/* ─────────────────────────────────────────────────────
   HANDLERS — Checkbox (marcar/desmarcar subtópico)
───────────────────────────────────────────────────── */

/**
 * Chamado quando um checkbox de subtópico é clicado.
 *
 * FLUXO:
 * checkbox clicado
 *   → encontra subtópico no state
 *   → atualiza subtopic.done
 *   → salva no localStorage
 *   → patch só a barra do tópico afetado
 *   → patch o header (progresso global + level)
 *   → patch a sidebar (contadores + donut)
 *
 * @param {HTMLInputElement} checkbox - o elemento clicado
 */
function handleCheckboxChange(checkbox) {
  const topicId    = parseInt(checkbox.dataset.topicId);
  const subtopicId = checkbox.dataset.subtopicId;

  const topic    = state.topics.find(t => t.id === topicId);
  const subtopic = topic?.subtopics.find(s => s.id === subtopicId);
  if (!subtopic) return;

  subtopic.done = checkbox.checked;
  saveState(state);

  const { done, total, pct } = calcTopicProgress(topic);
  patchTopicProgress(topicId, done, total, pct);
  patchHeader(calcGlobalProgress(state.topics));
  refreshStats();

  announce(`${subtopic.text}: ${checkbox.checked ? 'concluído' : 'pendente'}`);
}


/* ─────────────────────────────────────────────────────
   HANDLERS — Tópicos (adicionar, editar, remover)
───────────────────────────────────────────────────── */

/** Abre o modal em modo CRIAÇÃO de tópico. */
function handleAddTopic() {
  editingTopicId = null;

  const titleEl   = document.getElementById('modal-topic-title');
  const confirmEl = document.getElementById('btn-modal-topic-confirm');
  if (titleEl)   titleEl.textContent   = 'Novo Tópico';
  if (confirmEl) confirmEl.textContent = 'Criar';

  openModal('modal-topic');
}

/**
 * Abre o modal em modo EDIÇÃO, preenchendo o input com o título atual.
 * @param {string} targetId - ex: "topic-3"
 */
function handleEditTopic(targetId) {
  const topicId = parseInt(targetId.replace('topic-', ''));
  const topic   = state.topics.find(t => t.id === topicId);
  if (!topic) return;

  editingTopicId = topicId;

  const titleEl   = document.getElementById('modal-topic-title');
  const confirmEl = document.getElementById('btn-modal-topic-confirm');
  const inputEl   = document.getElementById('input-topic-name');
  if (titleEl)   titleEl.textContent    = 'Editar Tópico';
  if (confirmEl) confirmEl.textContent  = 'Salvar';
  if (inputEl)   inputEl.value          = topic.title;

  openModal('modal-topic');
  if (inputEl) setTimeout(() => { inputEl.focus(); inputEl.select(); }, 80);
}

/** Confirma a criação ou edição de um tópico. */
function handleConfirmTopic() {
  const inputEl = document.getElementById('input-topic-name');
  const name    = inputEl?.value.trim() ?? '';

  if (!name) {
    if (inputEl) {
      inputEl.focus();
      inputEl.style.borderColor = 'var(--neon-pink)';
      setTimeout(() => inputEl.style.borderColor = '', 1500);
    }
    return;
  }

  if (editingTopicId !== null) {
    /* EDIÇÃO: atualiza só o título */
    const topic = state.topics.find(t => t.id === editingTopicId);
    if (topic) {
      topic.title = name;
      patchTopicTitle(editingTopicId, name);
      announce(`Tópico renomeado para "${name}".`);
    }
  } else {
    /* CRIAÇÃO: novo tópico */
    const newTopic = {
      id:        state.nextTopicId++,
      title:     name,
      subtopics: [],
    };
    state.topics.push(newTopic);
    addTopicCard(newTopic);
    refreshStats();
    patchHeader(calcGlobalProgress(state.topics));
    announce(`Tópico "${name}" criado.`);
  }

  saveState(state);
  closeModal('modal-topic');
}

/**
 * Remove um tópico após confirmação.
 * @param {string} targetId - ex: "topic-3"
 */
function handleRemoveTopic(targetId) {
  const topicId = parseInt(targetId.replace('topic-', ''));
  const topic   = state.topics.find(t => t.id === topicId);
  if (!topic) return;

  if (!confirm(`Remover "${topic.title}"? Esta ação não pode ser desfeita.`)) return;

  state.topics = state.topics.filter(t => t.id !== topicId);
  saveState(state);

  removeTopicCard(topicId);

  /* Aguarda a animação de saída antes de atualizar os contadores */
  setTimeout(() => {
    refreshStats();
    patchHeader(calcGlobalProgress(state.topics));
  }, 230);

  announce(`Tópico "${topic.title}" removido.`);
}


/* ─────────────────────────────────────────────────────
   HANDLERS — Subtópicos (adicionar, remover)
───────────────────────────────────────────────────── */

/**
 * Abre o modal para adicionar um subtópico.
 * @param {string} targetId - ex: "topic-3"
 */
function handleAddSubtopic(targetId) {
  const topicId = parseInt(targetId.replace('topic-', ''));
  const topic   = state.topics.find(t => t.id === topicId);
  if (!topic) return;

  addingSubToId = topicId;

  const titleEl = document.getElementById('modal-subtopic-title');
  if (titleEl) titleEl.textContent = `Subtópico em "${topic.title}"`;

  openModal('modal-subtopic');
}

/** Confirma a criação de um subtópico. */
function handleConfirmSubtopic() {
  const inputEl = document.getElementById('input-subtopic-name');
  const name    = inputEl?.value.trim() ?? '';

  if (!name) {
    if (inputEl) {
      inputEl.focus();
      inputEl.style.borderColor = 'var(--neon-pink)';
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
  patchHeader(calcGlobalProgress(state.topics));
  refreshStats();

  closeModal('modal-subtopic');
  announce(`Subtópico "${name}" adicionado.`);
}

/**
 * Remove um subtópico individual do DOM e do state.
 *
 * FLUXO:
 * botão ✕ clicado
 *   → lê topic-id e subtopic-id do data-attribute do botão
 *   → remove do state via removeSubtopic() (state.js)
 *   → remove o <li id="sub-X"> do DOM com .remove() — sem recriar nada
 *   → patch só a barra do tópico afetado
 *   → patch o header (progresso global mudou)
 *   → patch sidebar (contadores mudaram)
 *
 * Recebe o próprio botão porque precisamos de dois data-attributes:
 * topicId e subtopicId — diferente dos outros handlers que recebem targetId.
 *
 * @param {HTMLElement} btn - o botão .btn-del-sub clicado
 */
function handleRemoveSubtopic(btn) {
  const topicId    = parseInt(btn.dataset.topicId);
  const subtopicId = btn.dataset.subtopicId;

  /* 1. Remove do state e persiste — recebe o tópico atualizado */
  const topic = removeSubtopic(state, topicId, subtopicId);
  if (!topic) return;

  /*
    2. Remove o <li> do DOM pelo id que definimos em renderSubtopicHTML().
    document.getElementById é O(1) — usa índice interno do browser,
    não percorre o DOM. É a busca mais rápida disponível.
  */
  document.getElementById(`sub-${subtopicId}`)?.remove();

  /* 3. Recalcula e atualiza só os elementos afetados */
  const { done, total, pct } = calcTopicProgress(topic);
  patchTopicProgress(topicId, done, total, pct);
  patchHeader(calcGlobalProgress(state.topics));
  refreshStats();

  announce('Subtópico removido.');
}


/* ─────────────────────────────────────────────────────
   HANDLERS — Streak
───────────────────────────────────────────────────── */

/**
 * Registra que o usuário estudou hoje.
 * Incrementa o streak se estudou ontem, reinicia se não.
 */
function handleLogToday() {
  const today  = todayStr();
  const streak = state.streak;

  if (streak.lastStudyDate === today) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  streak.count = streak.lastStudyDate === yesterdayStr
    ? streak.count + 1
    : 1;

  streak.lastStudyDate = today;

  if (!streak.history.includes(today)) {
    streak.history.push(today);
    if (streak.history.length > 30) streak.history.shift();
  }

  saveState(state);
  patchStreak(streak, today);
  announce(`Estudo registrado! Streak: ${streak.count} dias consecutivos.`);
}


/* ─────────────────────────────────────────────────────
   HANDLERS — Avatar motivacional
───────────────────────────────────────────────────── */

/** Abre o modal para definir avatar por URL externa. */
function handleSetAvatarUrl() {
  const inputEl = document.getElementById('input-avatar-url');
  if (inputEl && state.avatar?.startsWith('http')) {
    inputEl.value = state.avatar;
  }
  openModal('modal-avatar-url');
}

/** Confirma a URL digitada e salva no state. */
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

/**
 * Processa o upload de um arquivo de imagem.
 * FileReader converte para base64 (Data URL) para salvar no localStorage.
 * @param {Event} e - evento change do input[type="file"]
 */
function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader  = new FileReader();
  reader.onload = ev => {
    state.avatar = ev.target.result;
    saveState(state);
    patchAvatar(state.avatar);
    announce('Imagem motivacional carregada.');
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}


/* ─────────────────────────────────────────────────────
   DELEGAÇÃO DE EVENTOS
   
   UM único listener no documento captura todos os cliques.
   O switch roteia para o handler correto com base no data-action.
   
   Vantagens para hardware limitado:
   - Um listener = menos memória alocada por elemento
   - Funciona para elementos criados dinamicamente (novos cards)
   - Sem risco de "event listener leak" em elementos removidos
───────────────────────────────────────────────────── */

function bindEvents() {

  /* ── Delegação principal: todos os botões com data-action ── */
  document.addEventListener('click', e => {
    /*
      .closest() sobe na árvore do DOM a partir do elemento clicado
      até encontrar um ancestral com o atributo data-action.
      Funciona mesmo clicando em elementos filhos do botão.
    */
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const target = btn.dataset.target;

    switch (action) {
      /* Tópicos */
      case 'add-topic':          handleAddTopic();                break;
      case 'edit-topic':         handleEditTopic(target);         break;
      case 'remove-topic':       handleRemoveTopic(target);       break;

      /* Subtópicos */
      case 'add-subtopic':       handleAddSubtopic(target);       break;
      /*
        remove-subtopic recebe o botão inteiro (btn) ao invés do target,
        pois precisa de dois data-attributes: topic-id e subtopic-id.
        Os outros handlers só precisam de um (data-target).
      */
      case 'remove-subtopic':    handleRemoveSubtopic(btn);       break;

      /* Confirmações de modais */
      case 'confirm-topic':      handleConfirmTopic();            break;
      case 'confirm-subtopic':   handleConfirmSubtopic();         break;
      case 'confirm-avatar-url': handleConfirmAvatarUrl();        break;

      /* Fechar modal */
      case 'close-modal':        closeModal(target);              break;

      /* Streak */
      case 'log-today':          handleLogToday();                break;

      /* Avatar por URL */
      case 'set-avatar-url':     handleSetAvatarUrl();            break;
    }
  });

  /* ── Checkboxes de subtópicos (evento 'change', não 'click') ── */
  document.getElementById('topics-list')
    ?.addEventListener('change', e => {
      if (e.target.classList.contains('subtopic-check')) {
        handleCheckboxChange(e.target);
      }
    }, { passive: true });

  /* ── Fechar modal clicando no overlay (fundo escuro) ── */
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) closeAllModals();
  });

  /* ── Fechar modal com ESC ── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllModals();
  });

  /* ── Confirmar modal com Enter (quando input está focado) ── */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const modal = document.activeElement?.closest?.('.modal-overlay');
    if (!modal) return;
    if (modal.id === 'modal-topic')      handleConfirmTopic();
    if (modal.id === 'modal-subtopic')   handleConfirmSubtopic();
    if (modal.id === 'modal-avatar-url') handleConfirmAvatarUrl();
  });

  /* ── Upload de imagem por arquivo ── */
  document.getElementById('avatar-file-input')
    ?.addEventListener('change', handleAvatarUpload);
}


/* ─────────────────────────────────────────────────────
   INIT — ponto de entrada da aplicação
───────────────────────────────────────────────────── */

/**
 * Inicializa a aplicação:
 * 1. Carrega dados do localStorage (ou estado padrão)
 * 2. Calcula o progresso global para o renderAll
 * 3. Renderiza TUDO uma única vez
 * 4. Liga todos os event listeners
 *
 * Após o init(), NUNCA chame renderAll() novamente.
 * Use sempre as funções patch___ e add/remove.
 */
function init() {
  state = loadState();
  state.globalPct = calcGlobalProgress(state.topics);
  renderAll(state);
  bindEvents();
  console.log('[Dev Xodozada] 🚀 App iniciado.', state);
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();