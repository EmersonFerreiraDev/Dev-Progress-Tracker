/* =====================================================
   app.js — Progresso do Dev Xodozada
   JavaScript puro — sem frameworks
   =====================================================
   ARQUITETURA:
   ┌─ STATE          → objeto central com todos os dados
   ├─ PERSISTÊNCIA   → saveState / loadState (localStorage)
   ├─ RENDER         → funções que desenham o DOM
   ├─ CÁLCULOS       → progresso, level, stats
   ├─ EVENTOS        → event delegation + handlers
   └─ INIT           → ponto de entrada da aplicação
   ===================================================== */


/* ─────────────────────────────────────────────────────
   CONSTANTES
───────────────────────────────────────────────────── */

const STORAGE_KEY = 'devXodozada_v1';

// Mapeamento de porcentagem → level (sistema RPG)
const LEVELS = [
  { min: 0,  max: 20,  number: 1, title: 'Beginner'  },
  { min: 20, max: 40,  number: 2, title: 'Explorer'  },
  { min: 40, max: 60,  number: 3, title: 'Developer' },
  { min: 60, max: 80,  number: 4, title: 'Builder'   },
  { min: 80, max: 101, number: 5, title: 'Master'    },
];

// Abreviações dos dias da semana (Dom → Sáb) para o calendário de streak
const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];


/* ─────────────────────────────────────────────────────
   ESTADO PADRÃO
   Usado quando não há nada salvo no localStorage ainda
───────────────────────────────────────────────────── */

function defaultState() {
  return {
    topics: [
      {
        id: 1,
        title: 'Lógica de Programação',
        subtopics: [
          { id: '1-1', text: 'Variáveis',  done: true  },
          { id: '1-2', text: 'Operadores', done: true  },
          { id: '1-3', text: 'Loops',      done: false },
          { id: '1-4', text: 'Funções',    done: false },
        ],
      },
      {
        id: 2,
        title: 'HTML & CSS',
        subtopics: [
          { id: '2-1', text: 'Semântica HTML', done: true },
          { id: '2-2', text: 'Flexbox',        done: true },
          { id: '2-3', text: 'Grid Layout',    done: true },
        ],
      },
      {
        id: 3,
        title: 'JavaScript',
        subtopics: [
          { id: '3-1', text: 'Tipos de Dados',   done: true  },
          { id: '3-2', text: 'DOM Manipulation', done: false },
          { id: '3-3', text: 'Eventos',          done: false },
          { id: '3-4', text: 'Promises & Async', done: false },
          { id: '3-5', text: 'Fetch API',        done: false },
        ],
      },
    ],
    streak: {
      count:         0,    // dias consecutivos estudando
      lastStudyDate: null, // "YYYY-MM-DD" do último dia registrado
      history:       [],   // array de "YYYY-MM-DD" dos últimos 30 dias
    },
    avatar:      null, // string base64 ou URL externa
    nextTopicId: 4,    // próximo ID único para tópicos dinâmicos
  };
}


/* ─────────────────────────────────────────────────────
   ESTADO GLOBAL DA APLICAÇÃO
───────────────────────────────────────────────────── */

let appState = defaultState();

// Guarda qual tópico está sendo editado (null = modo criação)
let editingTopicId = null;

// Guarda para qual tópico um subtópico está sendo adicionado
let addingSubtopicToId = null;


/* ─────────────────────────────────────────────────────
   PERSISTÊNCIA — localStorage
───────────────────────────────────────────────────── */

/**
 * Salva o appState completo no localStorage como JSON.
 * Deve ser chamado após qualquer mudança de dados.
 */
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

/**
 * Carrega o estado salvo do localStorage.
 * Se não existir ou houver erro de parse, retorna o estado padrão.
 */
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultState();

    const parsed = JSON.parse(saved);

    // Merge com defaultState para garantir campos novos em saves antigos
    return {
      ...defaultState(),
      ...parsed,
      streak: { ...defaultState().streak, ...(parsed.streak || {}) },
    };
  } catch {
    return defaultState();
  }
}


/* ─────────────────────────────────────────────────────
   UTILITÁRIOS
───────────────────────────────────────────────────── */

/** Retorna a data de hoje no formato "YYYY-MM-DD". */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Anuncia uma mensagem para leitores de tela.
 * @param {string} msg
 */
function announce(msg) {
  const el = document.getElementById('sr-announcer');
  if (el) el.textContent = msg;
}

/**
 * Gera um ID único para subtópicos criados dinamicamente.
 * @param {number} topicId - ID do tópico pai
 */
function genSubId(topicId) {
  return `${topicId}-${Date.now()}`;
}


/* ─────────────────────────────────────────────────────
   CÁLCULOS
───────────────────────────────────────────────────── */

/**
 * Calcula quantos subtópicos de um tópico estão concluídos.
 * @param {object} topic
 * @returns {{ done, total, pct }}
 */
function calcTopicProgress(topic) {
  const total = topic.subtopics.length;
  const done  = topic.subtopics.filter(s => s.done).length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, pct };
}

/**
 * Calcula o progresso global somando todos os subtópicos de todos os tópicos.
 * @returns {number} porcentagem de 0 a 100
 */
function calcGlobalProgress() {
  let total = 0;
  let done  = 0;
  appState.topics.forEach(t => {
    total += t.subtopics.length;
    done  += t.subtopics.filter(s => s.done).length;
  });
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/**
 * Determina o level com base na porcentagem global.
 * @param {number} pct
 * @returns {object} level { number, title }
 */
function calcLevel(pct) {
  return LEVELS.find(l => pct >= l.min && pct < l.max) || LEVELS[LEVELS.length - 1];
}


/* ─────────────────────────────────────────────────────
   RENDER — TÓPICOS (geração dinâmica de HTML)
───────────────────────────────────────────────────── */

/**
 * Gera o HTML de um item de subtópico (checkbox).
 * @param {object} sub     - subtópico { id, text, done }
 * @param {number} topicId - ID do tópico pai
 */
function renderSubtopicHTML(sub, topicId) {
  return `
    <li class="subtopic-item" role="listitem">
      <label class="subtopic-label">
        <input
          type="checkbox"
          class="subtopic-check"
          data-topic-id="${topicId}"
          data-subtopic-id="${sub.id}"
          ${sub.done ? 'checked' : ''}
          aria-label="${sub.text} — ${sub.done ? 'concluído' : 'pendente'}"
        />
        <span class="check-custom" aria-hidden="true"></span>
        <span class="subtopic-text">${sub.text}</span>
      </label>
    </li>`;
}

/**
 * Gera o HTML completo de um card de tópico.
 * @param {object} topic
 */
function renderTopicCardHTML(topic) {
  const { done, total, pct } = calcTopicProgress(topic);
  const complete = pct === 100;
  const subsHTML = topic.subtopics.map(s => renderSubtopicHTML(s, topic.id)).join('');

  return `
    <article
      class="topic-card"
      id="topic-${topic.id}"
      data-topic-id="${topic.id}"
      role="listitem"
      aria-label="Tópico: ${topic.title}"
    >
      <header class="topic-header">
        <div class="topic-title-group">
          <span
            class="topic-status-dot ${complete ? 'is-complete' : ''}"
            id="topic-${topic.id}-dot"
            aria-hidden="true"
          ></span>
          <h3 class="topic-title" id="topic-${topic.id}-title">${topic.title}</h3>
        </div>

        <div class="topic-progress-mini" aria-label="Progresso do tópico">
          <span class="topic-progress-text" id="topic-${topic.id}-progress">${done}/${total}</span>
          <div class="topic-bar-track">
            <div
              class="topic-bar-fill ${complete ? 'is-complete' : ''}"
              id="topic-${topic.id}-bar"
              style="width:${pct}%"
            ></div>
          </div>
        </div>

        <div class="topic-actions" role="group" aria-label="Ações do tópico ${topic.title}">
          <button class="btn-icon btn-edit"
            data-action="edit-topic"
            data-target="topic-${topic.id}"
            aria-label="Editar tópico" title="Editar tópico">✎</button>
          <button class="btn-icon btn-remove"
            data-action="remove-topic"
            data-target="topic-${topic.id}"
            aria-label="Remover tópico" title="Remover tópico">✕</button>
        </div>
      </header>

      <ul class="subtopics-list" id="topic-${topic.id}-subtopics"
        role="list" aria-label="Subtópicos de ${topic.title}">
        ${subsHTML}
      </ul>

      <footer class="topic-footer">
        <button class="btn-add-sub"
          data-action="add-subtopic"
          data-target="topic-${topic.id}"
          aria-label="Adicionar subtópico em ${topic.title}">
          <span aria-hidden="true">＋</span> Adicionar subtópico
        </button>
      </footer>
    </article>`;
}

/**
 * Re-renderiza a lista completa de tópicos no DOM.
 */
function renderTopics() {
  const container = document.getElementById('topics-list');
  if (!container) return;

  if (appState.topics.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:48px 24px;color:var(--text-muted);
        font-family:var(--font-mono);font-size:0.8rem;line-height:2;">
        Nenhum tópico ainda.<br>
        Clique em <strong style="color:var(--neon-soft)">+ Adicionar novo tópico</strong> para começar!
      </div>`;
    return;
  }

  container.innerHTML = appState.topics.map(renderTopicCardHTML).join('');
}


/* ─────────────────────────────────────────────────────
   RENDER — HEADER (barra de progresso geral + level)
───────────────────────────────────────────────────── */

/**
 * Atualiza porcentagem, barra de progresso e badge de level no header.
 */
function renderHeader() {
  const pct   = calcGlobalProgress();
  const level = calcLevel(pct);

  const pctEl = document.getElementById('progress-percent');
  if (pctEl) pctEl.textContent = `${pct}%`;

  const fill = document.getElementById('progress-bar-fill');
  if (fill) fill.style.width = `${pct}%`;

  const track = document.getElementById('progress-bar-track');
  if (track) track.setAttribute('aria-valuenow', pct);

  const numEl = document.getElementById('level-number');
  if (numEl) {
    if (numEl.textContent !== String(level.number)) {
      // Animação de flash ao trocar de level
      numEl.classList.remove('level-change');
      void numEl.offsetWidth; // força reflow para reiniciar CSS animation
      numEl.classList.add('level-change');
    }
    numEl.textContent = level.number;
  }

  const titleEl = document.getElementById('level-title');
  if (titleEl) titleEl.textContent = level.title;
}


/* ─────────────────────────────────────────────────────
   RENDER — ESTATÍSTICAS (sidebar cards)
───────────────────────────────────────────────────── */

/**
 * Atualiza os contadores de tópicos concluídos/pendentes e o donut chart.
 */
function renderStats() {
  let done = 0, pending = 0;

  appState.topics.forEach(topic => {
    const { pct } = calcTopicProgress(topic);
    pct === 100 && topic.subtopics.length > 0 ? done++ : pending++;
  });

  const doneEl    = document.getElementById('stat-topics-done');
  const pendingEl = document.getElementById('stat-topics-pending');
  if (doneEl)    doneEl.textContent    = done;
  if (pendingEl) pendingEl.textContent = pending;

  renderDonut(done, done + pending);
}

/**
 * Atualiza o gráfico donut SVG.
 * O SVG tem r=15.9 → circunferência ≈ 100, então usamos base 100 no dasharray.
 * @param {number} done  - tópicos 100% concluídos
 * @param {number} total - total de tópicos
 */
function renderDonut(done, total) {
  const fill  = document.getElementById('donut-fill-topics');
  const label = document.getElementById('donut-label-topics');
  if (!fill || !label) return;

  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  fill.setAttribute('stroke-dasharray', `${pct} ${100 - pct}`);
  label.textContent = `${pct}%`;
}


/* ─────────────────────────────────────────────────────
   RENDER — STREAK (calendário + contador)
───────────────────────────────────────────────────── */

/**
 * Atualiza o card de streak: número, calendário e estado do botão.
 */
function renderStreak() {
  const streak = appState.streak;

  const numEl = document.getElementById('streak-number');
  if (numEl) numEl.textContent = streak.count;

  renderStreakCalendar();

  // Desabilita o botão se já registrou hoje
  const btn        = document.getElementById('btn-streak');
  const todayDone  = streak.lastStudyDate === todayStr();
  if (btn) {
    btn.textContent = todayDone ? '✔ Registrado hoje!' : '✔ Estudei hoje!';
    btn.disabled    = todayDone;
    btn.style.opacity = todayDone ? '0.5' : '1';
    btn.title = todayDone ? 'Você já registrou o estudo de hoje' : 'Registrar estudo de hoje';
  }
}

/**
 * Renderiza os 7 dias do mini calendário de streak.
 * Hoje fica destacado; dias estudados ficam em verde/roxo.
 */
function renderStreakCalendar() {
  const calendar = document.getElementById('streak-calendar');
  if (!calendar) return;

  const history = appState.streak.history || [];
  const now     = new Date();
  let html      = '';

  // Gera do dia mais antigo (6 dias atrás) até hoje
  for (let i = 6; i >= 0; i--) {
    const d       = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const studied = history.includes(dateStr);
    const isToday = i === 0;

    let cls = 'streak-day';
    if (isToday)       cls += ' is-today';
    else if (studied)  cls += ' is-done';

    html += `<div class="${cls}" role="listitem"
      aria-label="${dateStr}${studied ? ' — estudou' : ''}${isToday ? ' — hoje' : ''}">
      ${DAY_LABELS[d.getDay()]}
    </div>`;
  }

  calendar.innerHTML = html;
}


/* ─────────────────────────────────────────────────────
   RENDER — AVATAR motivacional
───────────────────────────────────────────────────── */

/**
 * Exibe ou oculta a imagem motivacional conforme o state.
 */
function renderAvatar() {
  const img         = document.getElementById('avatar-img');
  const placeholder = document.getElementById('avatar-placeholder');
  if (!img || !placeholder) return;

  if (appState.avatar) {
    img.src = appState.avatar;
    img.classList.remove('hidden');
    placeholder.style.display = 'none';
  } else {
    img.classList.add('hidden');
    img.src = '';
    placeholder.style.display = '';
  }
}


/* ─────────────────────────────────────────────────────
   RENDER ALL — atalho para re-renderizar tudo de uma vez
───────────────────────────────────────────────────── */

function renderAll() {
  renderTopics();
  renderHeader();
  renderStats();
  renderStreak();
  renderAvatar();
}


/* ─────────────────────────────────────────────────────
   MODAIS — abrir e fechar
───────────────────────────────────────────────────── */

/**
 * Abre um modal e foca o primeiro input.
 * @param {string} modalId
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('hidden');
  const firstInput = modal.querySelector('input');
  if (firstInput) {
    firstInput.value = '';
    setTimeout(() => firstInput.focus(), 50);
  }
}

/**
 * Fecha um modal e limpa seus inputs.
 * @param {string} modalId
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('hidden');
  modal.querySelectorAll('input').forEach(i => i.value = '');
}

/** Fecha todos os modais abertos de uma vez (usado no ESC). */
function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
}


/* ─────────────────────────────────────────────────────
   HANDLERS — Tópicos
───────────────────────────────────────────────────── */

/** Abre o modal em modo CRIAÇÃO de tópico. */
function handleAddTopic() {
  editingTopicId = null;

  const title   = document.getElementById('modal-topic-title');
  const confirm = document.getElementById('btn-modal-topic-confirm');
  if (title)   title.textContent   = 'Novo Tópico';
  if (confirm) confirm.textContent = 'Criar';

  openModal('modal-topic');
}

/**
 * Abre o modal em modo EDIÇÃO, preenchendo o input com o título atual.
 * @param {string} targetId - ex: "topic-1"
 */
function handleEditTopic(targetId) {
  const topicId = parseInt(targetId.replace('topic-', ''));
  const topic   = appState.topics.find(t => t.id === topicId);
  if (!topic) return;

  editingTopicId = topicId;

  const title     = document.getElementById('modal-topic-title');
  const confirm   = document.getElementById('btn-modal-topic-confirm');
  const nameInput = document.getElementById('input-topic-name');
  if (title)     title.textContent   = 'Editar Tópico';
  if (confirm)   confirm.textContent = 'Salvar';
  if (nameInput) nameInput.value     = topic.title;

  openModal('modal-topic');
  // Após abrindo, re-foca e seleciona o texto para edição rápida
  if (nameInput) setTimeout(() => { nameInput.focus(); nameInput.select(); }, 80);
}

/**
 * Remove um tópico após confirmação nativa do browser.
 * @param {string} targetId - ex: "topic-1"
 */
function handleRemoveTopic(targetId) {
  const topicId = parseInt(targetId.replace('topic-', ''));
  const topic   = appState.topics.find(t => t.id === topicId);
  if (!topic) return;

  if (!confirm(`Remover "${topic.title}"? Esta ação não pode ser desfeita.`)) return;

  appState.topics = appState.topics.filter(t => t.id !== topicId);
  saveState();
  renderAll();
  announce(`Tópico "${topic.title}" removido.`);
}

/**
 * Lê o input do modal e cria ou atualiza um tópico.
 */
function handleConfirmTopic() {
  const nameInput = document.getElementById('input-topic-name');
  const name      = nameInput?.value.trim() ?? '';

  if (!name) {
    if (nameInput) {
      nameInput.focus();
      nameInput.style.borderColor = 'var(--neon-pink)';
      setTimeout(() => nameInput.style.borderColor = '', 1500);
    }
    return;
  }

  if (editingTopicId !== null) {
    // EDIÇÃO: apenas atualiza o título
    const topic = appState.topics.find(t => t.id === editingTopicId);
    if (topic) { topic.title = name; announce(`Tópico renomeado para "${name}".`); }
  } else {
    // CRIAÇÃO: adiciona novo tópico
    appState.topics.push({ id: appState.nextTopicId++, title: name, subtopics: [] });
    announce(`Tópico "${name}" criado.`);
  }

  saveState();
  closeModal('modal-topic');
  renderAll();
}


/* ─────────────────────────────────────────────────────
   HANDLERS — Subtópicos
───────────────────────────────────────────────────── */

/**
 * Abre o modal para adicionar subtópico informando o tópico pai.
 * @param {string} targetId - ex: "topic-1"
 */
function handleAddSubtopic(targetId) {
  const topicId = parseInt(targetId.replace('topic-', ''));
  const topic   = appState.topics.find(t => t.id === topicId);
  if (!topic) return;

  addingSubtopicToId = topicId;

  const titleEl = document.getElementById('modal-subtopic-title');
  if (titleEl) titleEl.textContent = `Subtópico em "${topic.title}"`;

  openModal('modal-subtopic');
}

/**
 * Lê o input do modal e adiciona o subtópico ao tópico pai.
 */
function handleConfirmSubtopic() {
  const nameInput = document.getElementById('input-subtopic-name');
  const name      = nameInput?.value.trim() ?? '';

  if (!name) {
    if (nameInput) {
      nameInput.focus();
      nameInput.style.borderColor = 'var(--neon-pink)';
      setTimeout(() => nameInput.style.borderColor = '', 1500);
    }
    return;
  }

  const topic = appState.topics.find(t => t.id === addingSubtopicToId);
  if (!topic) return;

  topic.subtopics.push({ id: genSubId(topic.id), text: name, done: false });

  saveState();
  closeModal('modal-subtopic');
  renderAll();
  announce(`Subtópico "${name}" adicionado.`);
}

/**
 * Atualiza o estado done/undone de um subtópico no appState.
 * @param {HTMLInputElement} checkbox
 */
function handleCheckboxChange(checkbox) {
  const topicId    = parseInt(checkbox.dataset.topicId);
  const subtopicId = checkbox.dataset.subtopicId;

  const topic    = appState.topics.find(t => t.id === topicId);
  const subtopic = topic?.subtopics.find(s => s.id === subtopicId);
  if (!subtopic) return;

  subtopic.done = checkbox.checked;
  saveState();

  // Atualiza apenas os elementos visuais afetados (sem re-renderizar os cards)
  updateTopicProgressDOM(topicId);
  renderHeader();
  renderStats();

  announce(`${subtopic.text}: ${checkbox.checked ? 'concluído' : 'pendente'}`);
}

/**
 * Atualiza os elementos visuais de progresso de um tópico
 * SEM re-renderizar o card inteiro (evita perda de estado dos checkboxes).
 * @param {number} topicId
 */
function updateTopicProgressDOM(topicId) {
  const topic = appState.topics.find(t => t.id === topicId);
  if (!topic) return;

  const { done, total, pct } = calcTopicProgress(topic);
  const complete = pct === 100;

  const progressText = document.getElementById(`topic-${topicId}-progress`);
  if (progressText) progressText.textContent = `${done}/${total}`;

  const bar = document.getElementById(`topic-${topicId}-bar`);
  if (bar) {
    bar.style.width = `${pct}%`;
    bar.classList.toggle('is-complete', complete);
  }

  const dot = document.getElementById(`topic-${topicId}-dot`);
  if (dot) dot.classList.toggle('is-complete', complete);
}


/* ─────────────────────────────────────────────────────
   HANDLER — Streak de estudos
───────────────────────────────────────────────────── */

/**
 * Registra o estudo do dia atual.
 * Incrementa o streak se estudou ontem; reinicia caso contrário.
 */
function handleLogToday() {
  const today  = todayStr();
  const streak = appState.streak;

  // Não registra duas vezes no mesmo dia
  if (streak.lastStudyDate === today) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // Streak só continua se estudou no dia anterior
  streak.count = streak.lastStudyDate === yesterdayStr ? streak.count + 1 : 1;

  streak.lastStudyDate = today;

  // Adiciona ao histórico e mantém no máximo 30 dias
  if (!streak.history.includes(today)) {
    streak.history.push(today);
    if (streak.history.length > 30) streak.history.shift();
  }

  saveState();
  renderStreak();
  announce(`Estudo registrado! Streak: ${streak.count} dias consecutivos.`);
}


/* ─────────────────────────────────────────────────────
   HANDLERS — Avatar motivacional
───────────────────────────────────────────────────── */

/** Abre o modal para definir avatar por URL externa. */
function handleSetAvatarUrl() {
  const input = document.getElementById('input-avatar-url');
  // Preenche com a URL atual se já existe uma
  if (input && appState.avatar?.startsWith('http')) {
    input.value = appState.avatar;
  }
  openModal('modal-avatar-url');
}

/** Confirma a URL e salva como avatar. */
function handleConfirmAvatarUrl() {
  const input = document.getElementById('input-avatar-url');
  const url   = input?.value.trim() ?? '';
  if (!url) { input?.focus(); return; }

  appState.avatar = url;
  saveState();
  closeModal('modal-avatar-url');
  renderAvatar();
  announce('Imagem motivacional atualizada.');
}

/**
 * Processa o upload de arquivo e converte para base64.
 * @param {Event} e - evento change do input type="file"
 */
function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader    = new FileReader();
  reader.onload   = ev => {
    appState.avatar = ev.target.result; // data URL (base64)
    saveState();
    renderAvatar();
    announce('Imagem motivacional carregada com sucesso.');
  };
  reader.readAsDataURL(file);
  e.target.value = ''; // reseta para permitir re-upload do mesmo arquivo
}


/* ─────────────────────────────────────────────────────
   EVENT DELEGATION — centro de controle
───────────────────────────────────────────────────── */

/**
 * Liga todos os event listeners da aplicação.
 * Usa Event Delegation para os botões com data-action.
 */
function bindEvents() {

  /* ── Todos os botões com data-action ── */
  document.addEventListener('click', e => {
    const btn    = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const target = btn.dataset.target;

    switch (action) {
      case 'add-topic':          handleAddTopic();              break;
      case 'edit-topic':         handleEditTopic(target);       break;
      case 'remove-topic':       handleRemoveTopic(target);     break;
      case 'add-subtopic':       handleAddSubtopic(target);     break;
      case 'confirm-topic':      handleConfirmTopic();          break;
      case 'confirm-subtopic':   handleConfirmSubtopic();       break;
      case 'confirm-avatar-url': handleConfirmAvatarUrl();      break;
      case 'close-modal':        closeModal(target);            break;
      case 'log-today':          handleLogToday();              break;
      case 'set-avatar-url':     handleSetAvatarUrl();          break;
    }
  });

  /* ── Fechar modal clicando no fundo escuro (overlay) ── */
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) closeAllModals();
  });

  /* ── Fechar modal com ESC ── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllModals();
  });

  /* ── Confirmar modal com Enter enquanto input está focado ── */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const modal = document.activeElement?.closest?.('.modal-overlay');
    if (!modal) return;
    if (modal.id === 'modal-topic')      handleConfirmTopic();
    if (modal.id === 'modal-subtopic')   handleConfirmSubtopic();
    if (modal.id === 'modal-avatar-url') handleConfirmAvatarUrl();
  });

  /* ── Checkboxes de subtópicos (delegado para o container) ── */
  document.getElementById('topics-list')?.addEventListener('change', e => {
    if (e.target.classList.contains('subtopic-check')) handleCheckboxChange(e.target);
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
 * 1. Carrega o estado salvo (ou o padrão se for a primeira visita)
 * 2. Renderiza toda a interface com os dados carregados
 * 3. Liga todos os event listeners
 */
function init() {
  appState = loadState();
  renderAll();
  bindEvents();
  console.log('[Dev Xodozada] 🚀 App iniciado.', appState);
}

// Garante que o DOM está pronto antes de inicializar
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();