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

import { loadState, saveState, defaultState } from './state.js';
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
   
   Estas variáveis controlam "o que está acontecendo agora"
   durante interações com modais.
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
   UTILITÁRIO INTERNO — recalcula stats e atualiza sidebar
   
   Centraliza o cálculo de tópicos concluídos/pendentes
   para não repetir esse bloco em vários handlers.
───────────────────────────────────────────────────── */

/**
 * Recalcula os contadores da sidebar e o donut chart.
 * Chamada após qualquer mudança que afete o status dos tópicos.
 */
function refreshStats() {
  let done = 0;
  let pending = 0;

  /*
    Para cada tópico, verifica se TODOS os subtópicos estão concluídos.
    Um tópico sem subtópicos é considerado pendente.
  */
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

  /* Encontra o tópico e subtópico no state */
  const topic    = state.topics.find(t => t.id === topicId);
  const subtopic = topic?.subtopics.find(s => s.id === subtopicId);
  if (!subtopic) return; /* segurança: ignora se não encontrar */

  /* 1. Atualiza o dado */
  subtopic.done = checkbox.checked;

  /* 2. Persiste imediatamente */
  saveState(state);

  /* 3. Recalcula progresso do tópico afetado */
  const { done, total, pct } = calcTopicProgress(topic);

  /* 4. Atualiza DOM — só os elementos deste tópico */
  patchTopicProgress(topicId, done, total, pct);

  /* 5. Atualiza header com novo progresso global */
  const globalPct = calcGlobalProgress(state.topics);
  patchHeader(globalPct);

  /* 6. Atualiza sidebar */
  refreshStats();

  /* 7. Anuncia para leitores de tela */
  announce(`${subtopic.text}: ${checkbox.checked ? 'concluído' : 'pendente'}`);
}


/* ─────────────────────────────────────────────────────
   HANDLERS — Tópicos (adicionar, editar, remover)
───────────────────────────────────────────────────── */

/**
 * Abre o modal em modo CRIAÇÃO de tópico.
 * Reseta editingTopicId para null para indicar que é um novo tópico.
 */
function handleAddTopic() {
  editingTopicId = null;

  /* Configura o modal para modo criação */
  const titleEl   = document.getElementById('modal-topic-title');
  const confirmEl = document.getElementById('btn-modal-topic-confirm');
  if (titleEl)   titleEl.textContent   = 'Novo Tópico';
  if (confirmEl) confirmEl.textContent = 'Criar';

  openModal('modal-topic');
}

/**
 * Abre o modal em modo EDIÇÃO, preenchendo o input com o título atual.
 * @param {string} targetId - ex: "topic-3" (vem do data-target do botão)
 */
function handleEditTopic(targetId) {
  /* Extrai o número do ID: "topic-3" → 3 */
  const topicId = parseInt(targetId.replace('topic-', ''));
  const topic   = state.topics.find(t => t.id === topicId);
  if (!topic) return;

  /* Guarda qual tópico está sendo editado */
  editingTopicId = topicId;

  /* Configura o modal para modo edição */
  const titleEl   = document.getElementById('modal-topic-title');
  const confirmEl = document.getElementById('btn-modal-topic-confirm');
  const inputEl   = document.getElementById('input-topic-name');
  if (titleEl)   titleEl.textContent = 'Editar Tópico';
  if (confirmEl) confirmEl.textContent = 'Salvar';
  if (inputEl)   inputEl.value = topic.title; /* preenche com valor atual */

  openModal('modal-topic');

  /* Seleciona o texto para edição rápida */
  if (inputEl) setTimeout(() => { inputEl.focus(); inputEl.select(); }, 80);
}

/**
 * Confirma a criação ou edição de um tópico.
 * Chamado pelo botão "Criar/Salvar" do modal.
 */
function handleConfirmTopic() {
  const inputEl = document.getElementById('input-topic-name');
  const name    = inputEl?.value.trim() ?? '';

  /* Valida: não permite nome vazio */
  if (!name) {
    if (inputEl) {
      inputEl.focus();
      /* Flash vermelho no border para indicar erro */
      inputEl.style.borderColor = 'var(--neon-pink)';
      setTimeout(() => inputEl.style.borderColor = '', 1500);
    }
    return;
  }

  if (editingTopicId !== null) {
    /* ── MODO EDIÇÃO: atualiza só o título no state e no DOM ── */
    const topic = state.topics.find(t => t.id === editingTopicId);
    if (topic) {
      topic.title = name;
      /* Patch cirúrgico: só o <h3> do card muda */
      patchTopicTitle(editingTopicId, name);
      announce(`Tópico renomeado para "${name}".`);
    }
  } else {
    /* ── MODO CRIAÇÃO: cria objeto novo e insere no state e no DOM ── */
    const newTopic = {
      id:        state.nextTopicId++,
      title:     name,
      subtopics: [],
    };
    state.topics.push(newTopic);
    /* Insere apenas o novo card, sem recriar a lista */
    addTopicCard(newTopic);
    announce(`Tópico "${name}" criado.`);

    /* Atualiza header e sidebar pois o total de tópicos mudou */
    refreshStats();
    patchHeader(calcGlobalProgress(state.topics));
  }

  saveState(state);
  closeModal('modal-topic');
}

/**
 * Remove um tópico após confirmação nativa do browser.
 * Usa ui.removeTopicCard() que já tem animação de saída.
 * @param {string} targetId - ex: "topic-3"
 */
function handleRemoveTopic(targetId) {
  const topicId = parseInt(targetId.replace('topic-', ''));
  const topic   = state.topics.find(t => t.id === topicId);
  if (!topic) return;

  if (!confirm(`Remover "${topic.title}"? Esta ação não pode ser desfeita.`)) return;

  /* 1. Remove do state */
  state.topics = state.topics.filter(t => t.id !== topicId);
  saveState(state);

  /*
    2. Remove do DOM com animação.
    removeTopicCard() cuida do timeout interno (220ms).
    Atualizamos stats APÓS o timeout para sincronizar com a animação.
  */
  removeTopicCard(topicId);

  setTimeout(() => {
    refreshStats();
    patchHeader(calcGlobalProgress(state.topics));
  }, 230);

  announce(`Tópico "${topic.title}" removido.`);
}


/* ─────────────────────────────────────────────────────
   HANDLERS — Subtópicos (adicionar)
───────────────────────────────────────────────────── */

/**
 * Abre o modal para adicionar um subtópico.
 * @param {string} targetId - ex: "topic-3"
 */
function handleAddSubtopic(targetId) {
  const topicId = parseInt(targetId.replace('topic-', ''));
  const topic   = state.topics.find(t => t.id === topicId);
  if (!topic) return;

  /* Guarda o tópico pai para usar no confirm */
  addingSubToId = topicId;

  const titleEl = document.getElementById('modal-subtopic-title');
  if (titleEl) titleEl.textContent = `Subtópico em "${topic.title}"`;

  openModal('modal-subtopic');
}

/**
 * Confirma a criação de um subtópico.
 * Chamado pelo botão "Salvar" do modal de subtópico.
 */
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

  /* Cria o subtópico e adiciona ao state */
  const newSub = { id: genSubId(topic.id), text: name, done: false };
  topic.subtopics.push(newSub);
  saveState(state);

  /* Insere só o novo item na lista, sem recriar o card */
  addSubtopicItem(topic.id, newSub);

  /* Recalcula progresso do tópico (total de itens aumentou) */
  const { done, total, pct } = calcTopicProgress(topic);
  patchTopicProgress(topic.id, done, total, pct);
  patchHeader(calcGlobalProgress(state.topics));
  refreshStats();

  closeModal('modal-subtopic');
  announce(`Subtópico "${name}" adicionado.`);
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

  /* Não registra duas vezes no mesmo dia */
  if (streak.lastStudyDate === today) return;

  /* Verifica se estudou ontem para manter o streak */
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  streak.count = streak.lastStudyDate === yesterdayStr
    ? streak.count + 1  /* continuou o streak */
    : 1;                /* recomeça do zero */

  streak.lastStudyDate = today;

  /* Adiciona ao histórico, mantendo no máximo 30 dias */
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
  /* Preenche com a URL atual se já houver uma */
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
    state.avatar = ev.target.result; /* string base64 */
    saveState(state);
    patchAvatar(state.avatar);
    announce('Imagem motivacional carregada.');
  };
  reader.readAsDataURL(file);

  /* Reseta o input para permitir re-upload do mesmo arquivo */
  e.target.value = '';
}


/* ─────────────────────────────────────────────────────
   DELEGAÇÃO DE EVENTOS
   
   UM único listener no documento captura todos os cliques.
   O switch roteia para o handler correto com base no data-action.
   
   Vantagem para hardware limitado:
   - Sem event listener = menos memória alocada por elemento
   - Funciona para elementos criados dinamicamente (novos cards)
   - Sem risco de "event listener leak" em elementos removidos
───────────────────────────────────────────────────── */

function bindEvents() {

  /* ── Delegação principal: todos os botões com data-action ── */
  document.addEventListener('click', e => {
    /*
      .closest() sobe na árvore do DOM a partir do elemento clicado
      até encontrar um ancestral com o atributo data-action.
      Isso funciona mesmo clicando em elementos filhos do botão (ex: ícones).
    */
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const target = btn.dataset.target;

    switch (action) {
      /* Tópicos */
      case 'add-topic':          handleAddTopic();           break;
      case 'edit-topic':         handleEditTopic(target);    break;
      case 'remove-topic':       handleRemoveTopic(target);  break;

      /* Subtópicos */
      case 'add-subtopic':       handleAddSubtopic(target);  break;

      /* Confirmações de modais */
      case 'confirm-topic':      handleConfirmTopic();       break;
      case 'confirm-subtopic':   handleConfirmSubtopic();    break;
      case 'confirm-avatar-url': handleConfirmAvatarUrl();   break;

      /* Fechar modal */
      case 'close-modal':        closeModal(target);         break;

      /* Streak */
      case 'log-today':          handleLogToday();           break;

      /* Avatar por URL */
      case 'set-avatar-url':     handleSetAvatarUrl();       break;
    }
  });

  /* ── Checkboxes de subtópicos (evento 'change', não 'click') ──
     Delegado no container dos tópicos para máxima eficiência.
     Só escuta o container, não cada checkbox individualmente. */
  document.getElementById('topics-list')
    ?.addEventListener('change', e => {
      if (e.target.classList.contains('subtopic-check')) {
        handleCheckboxChange(e.target);
      }
    }, { passive: true }); /* passive: não bloqueia o scroll */

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

    /* Roteia para o confirm correto dependendo de qual modal está aberto */
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
   
   Chamada automaticamente quando o DOM está pronto.
   Executa na seguinte ordem:
   1. Carrega dados do localStorage (ou estado padrão)
   2. Calcula o progresso global para o renderAll
   3. Renderiza TUDO uma única vez
   4. Liga todos os eventos
   
   Após o init(), NUNCA chame renderAll() novamente.
   Use sempre as funções patch___ e add/remove.
───────────────────────────────────────────────────── */

function init() {
  /* 1. Restaura dados salvos */
  state = loadState();

  /*
    2. Adiciona globalPct ao state para o renderAll usar.
    renderAll() precisa deste valor para desenhar a barra do header.
  */
  state.globalPct = calcGlobalProgress(state.topics);

  /* 3. Renderiza a interface completa — única vez */
  renderAll(state);

  /* 4. Liga todos os event listeners */
  bindEvents();

  console.log('[Dev Xodozada] 🚀 App iniciado.', state);
}

/*
  Garante que o DOM existe antes de rodar o init().
  'loading' = HTML ainda sendo parseado → espera o evento.
  Qualquer outro valor = DOM já pronto → roda agora.
*/
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();