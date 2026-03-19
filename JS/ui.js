/* ─────────────────────────────────────────────────────
   ui.js — Renderização e Manipulação do DOM
   
   ESTRATÉGIA DE PERFORMANCE:
   ┌─ renderAll()         → só usada na primeira carga da página
   ├─ patchTopicProgress()→ atualiza barra/texto de UM tópico (checkbox)
   ├─ patchTopicTitle()   → atualiza só o título de UM tópico (edição)
   ├─ addTopicCard()      → insere UM card novo no fim da lista
   ├─ removeTopicCard()   → remove UM card da lista
   └─ patchHeader()       → atualiza barra global e level
   
   REGRA DE OURO:
   Nunca use container.innerHTML = lista inteira após a carga inicial.
   Sempre ache o elemento pelo ID e mude só a propriedade necessária.
───────────────────────────────────────────────────── */
import { calcTopicProgress, calcLevel, DAY_LABELS } from './utils.js';


/* ─────────────────────────────────────────────────────
   UTILITÁRIO — acessibilidade
───────────────────────────────────────────────────── */

/**
 * Anuncia uma mensagem para leitores de tela (aria-live).
 * Usuários com deficiência visual ouvem o que mudou na tela.
 * @param {string} msg - texto a ser anunciado
 */
export function announce(msg) {
  const el = document.getElementById('sr-announcer');
  if (el) el.textContent = msg;
}


/* ─────────────────────────────────────────────────────
   GERAÇÃO DE HTML (usado só na primeira carga)
   Estas funções montam strings de HTML.
   Após a carga inicial, as funções patch___ abaixo
   são usadas no lugar destas.
───────────────────────────────────────────────────── */

/**
 * Gera a string HTML de um item de subtópico (linha do checklist).
 * Chamada internamente por renderTopicCardHTML().
 * @param {object} sub     - { id, text, done }
 * @param {number} topicId - ID do tópico pai
 */
function renderSubtopicHTML(sub, topicId) {
  return `
    <li class="subtopic-item" role="listitem">
      <label class="subtopic-label">
        <input type="checkbox" class="subtopic-check"
          data-topic-id="${topicId}"
          data-subtopic-id="${sub.id}"
          ${sub.done ? 'checked' : ''} />
        <span class="check-custom" aria-hidden="true"></span>
        <span class="subtopic-text">${sub.text}</span>
      </label>
    </li>`;
}

/**
 * Gera a string HTML completa de um card de tópico.
 * Usada na carga inicial (renderAll) e ao adicionar um tópico novo.
 * @param {object} topic - objeto do tópico com subtopics[]
 */
export function renderTopicCardHTML(topic) {
  const { done, total, pct } = calcTopicProgress(topic);
  const complete = pct === 100;
  const subsHTML = topic.subtopics.map(s => renderSubtopicHTML(s, topic.id)).join('');

  return `
    <article class="topic-card" id="topic-${topic.id}" data-topic-id="${topic.id}">
      <header class="topic-header">

        <div class="topic-title-group">
          <span
            class="topic-status-dot ${complete ? 'is-complete' : ''}"
            id="topic-${topic.id}-dot"
          ></span>
          <!-- O id abaixo é alvo de patchTopicTitle() -->
          <h3 class="topic-title" id="topic-${topic.id}-title">${topic.title}</h3>
        </div>

        <div class="topic-progress-mini">
          <!-- O id abaixo é alvo de patchTopicProgress() -->
          <span class="topic-progress-text" id="topic-${topic.id}-progress">${done}/${total}</span>
          <div class="topic-bar-track">
            <!-- O id abaixo é alvo de patchTopicProgress() -->
            <div
              class="topic-bar-fill ${complete ? 'is-complete' : ''}"
              id="topic-${topic.id}-bar"
              style="width:${pct}%"
            ></div>
          </div>
        </div>

        <div class="topic-actions">
          <button class="btn-icon btn-edit"
            data-action="edit-topic"
            data-target="topic-${topic.id}"
            title="Editar tópico">✎</button>
          <button class="btn-icon btn-remove"
            data-action="remove-topic"
            data-target="topic-${topic.id}"
            title="Remover tópico">✕</button>
        </div>

      </header>

      <!-- id abaixo é alvo de addSubtopicItem() -->
      <ul class="subtopics-list" id="topic-${topic.id}-subtopics">${subsHTML}</ul>

      <footer class="topic-footer">
        <button class="btn-add-sub"
          data-action="add-subtopic"
          data-target="topic-${topic.id}">＋ Adicionar subtópico</button>
      </footer>
    </article>`;
}


/* ─────────────────────────────────────────────────────
   RENDER INICIAL — primeira vez que a página carrega
   Após isso, use as funções patch___ abaixo.
───────────────────────────────────────────────────── */

/**
 * Renderiza TUDO do zero.
 * Use APENAS na inicialização (init()) ou após reset total.
 * Para qualquer interação do usuário, prefira as funções patch___.
 * @param {object} state - appState completo
 */
export function renderAll(state) {

  /* ── Lista de tópicos ── */
  const container = document.getElementById('topics-list');
  if (container) {
    container.innerHTML = state.topics.length > 0
      ? state.topics.map(renderTopicCardHTML).join('')
      : `<p style="text-align:center;padding:2rem;color:var(--text-muted);">
           Nenhum tópico ainda.
         </p>`;
  }

  /* ── Header: barra global + level ── */
  patchHeader(state.globalPct);

  /* ── Streak ── */
  const numStreak = document.getElementById('streak-number');
  if (numStreak) numStreak.textContent = state.streak.count;

  renderStreakCalendar(state.streak);

  /* ── Avatar motivacional ── */
  patchAvatar(state.avatar);
}


/* ─────────────────────────────────────────────────────
   FUNÇÕES PATCH — atualização PARCIAL do DOM
   
   Cada função recebe apenas os dados necessários,
   encontra o elemento pelo ID e altera só o que mudou.
   Nenhuma delas apaga ou recria outros elementos.
───────────────────────────────────────────────────── */

/**
 * [PATCH] Atualiza a barra de progresso, o texto "done/total"
 * e o status dot de UM tópico específico.
 *
 * Chamada quando: usuário marca ou desmarca um checkbox.
 *
 * Por que não usar innerHTML aqui?
 * Porque o card tem checkboxes com estado (checked/unchecked).
 * Se recriássemos o HTML, o browser perderia o estado visual
 * por uma fração de segundo — causando um "piscar".
 *
 * @param {number} topicId - ID do tópico a atualizar
 * @param {number} done    - quantidade de subtópicos concluídos
 * @param {number} total   - quantidade total de subtópicos
 * @param {number} pct     - porcentagem (0–100)
 */
export function patchTopicProgress(topicId, done, total, pct) {
  const complete = pct === 100;

  /* Texto "2/4" */
  const progressText = document.getElementById(`topic-${topicId}-progress`);
  if (progressText) progressText.textContent = `${done}/${total}`;

  /* Largura da barra colorida */
  const bar = document.getElementById(`topic-${topicId}-bar`);
  if (bar) {
    bar.style.width = `${pct}%`;
    /*
      classList.toggle(classe, condicao):
      adiciona a classe se condicao=true, remove se condicao=false.
      Muito mais limpo do que if/else.
    */
    bar.classList.toggle('is-complete', complete);
  }

  /* Bolinha de status (cinza → verde quando 100%) */
  const dot = document.getElementById(`topic-${topicId}-dot`);
  if (dot) dot.classList.toggle('is-complete', complete);
}

/**
 * [PATCH] Atualiza SOMENTE o texto do título de um tópico.
 *
 * Chamada quando: usuário edita o nome de um tópico e confirma.
 * Não recria o card — só troca os caracteres do <h3>.
 *
 * @param {number} topicId  - ID do tópico
 * @param {string} newTitle - novo título digitado
 */
export function patchTopicTitle(topicId, newTitle) {
  const titleEl = document.getElementById(`topic-${topicId}-title`);
  /*
    textContent é mais seguro que innerHTML para texto puro:
    não interpreta HTML, evitando XSS (injeção de código malicioso).
  */
  if (titleEl) titleEl.textContent = newTitle;
}

/**
 * [PATCH] Atualiza a barra de progresso GLOBAL e o badge de level no header.
 *
 * Chamada quando: qualquer checkbox muda (pois afeta o progresso total).
 *
 * @param {number} pct - porcentagem global (0–100)
 */
export function patchHeader(pct) {
  /* Barra de progresso global */
  const fill = document.getElementById('progress-bar-fill');
  if (fill) fill.style.width = `${pct}%`;

  /* Texto de porcentagem */
  const pctEl = document.getElementById('progress-percent');
  if (pctEl) pctEl.textContent = `${pct}%`;

  /* aria-valuenow para acessibilidade */
  const track = document.getElementById('progress-bar-track');
  if (track) track.setAttribute('aria-valuenow', pct);

  /* Calcula e atualiza o level */
  const level = calcLevel(pct);

  const numEl = document.getElementById('level-number');
  if (numEl) numEl.textContent = level.number;

  const titleEl = document.getElementById('level-title');
  if (titleEl) titleEl.textContent = level.title;
}

/**
 * [PATCH] Atualiza os contadores de tópicos concluídos e pendentes
 * nos cards de estatísticas da sidebar.
 *
 * Chamada quando: qualquer checkbox muda, tópico é adicionado/removido.
 *
 * @param {number} done    - número de tópicos 100% concluídos
 * @param {number} pending - número de tópicos ainda incompletos
 */
export function patchStats(done, pending) {
  const doneEl    = document.getElementById('stat-topics-done');
  const pendingEl = document.getElementById('stat-topics-pending');
  if (doneEl)    doneEl.textContent    = done;
  if (pendingEl) pendingEl.textContent = pending;

  /* Atualiza o gráfico donut junto */
  patchDonut(done, done + pending);
}

/**
 * [PATCH] Atualiza o gráfico de rosca (donut SVG) da sidebar.
 * Usa stroke-dasharray para "preencher" o círculo proporcionalmente.
 *
 * O SVG tem r=15.9 → circunferência ≈ 100 → base 100 no dasharray.
 * Exemplo: 33% concluído → stroke-dasharray="33 67"
 *
 * @param {number} done  - tópicos concluídos
 * @param {number} total - total de tópicos
 */
export function patchDonut(done, total) {
  const fill  = document.getElementById('donut-fill-topics');
  const label = document.getElementById('donut-label-topics');
  if (!fill || !label) return;

  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  fill.setAttribute('stroke-dasharray', `${pct} ${100 - pct}`);
  label.textContent = `${pct}%`;
}

/**
 * [PATCH] Atualiza a imagem/GIF motivacional.
 * Mostra a imagem se existir, ou volta ao placeholder.
 *
 * @param {string|null} avatarSrc - URL ou base64 da imagem, ou null
 */
export function patchAvatar(avatarSrc) {
  const img         = document.getElementById('avatar-img');
  const placeholder = document.getElementById('avatar-placeholder');
  if (!img || !placeholder) return;

  if (avatarSrc) {
    img.src = avatarSrc;
    img.classList.remove('hidden');
    placeholder.style.display = 'none';
  } else {
    img.classList.add('hidden');
    img.src = '';
    placeholder.style.display = '';
  }
}


/* ─────────────────────────────────────────────────────
   FUNÇÕES DE LISTA — adicionar e remover itens
   Usam insertAdjacentHTML e element.remove()
   ao invés de reconstruir a lista toda.
───────────────────────────────────────────────────── */

/**
 * [LISTA] Insere UM card de tópico novo no final da lista.
 *
 * insertAdjacentHTML('beforeend', html) é muito mais eficiente
 * que container.innerHTML += html, porque:
 * - innerHTML += destrói e recria TODOS os elementos existentes
 * - insertAdjacentHTML apenas anexa o novo, sem tocar nos outros
 *
 * Chamada quando: usuário confirma "Adicionar novo tópico".
 *
 * @param {object} topic - objeto do novo tópico
 */
export function addTopicCard(topic) {
  const container = document.getElementById('topics-list');
  if (!container) return;

  /* Remove a mensagem "Nenhum tópico ainda." se existir */
  const emptyMsg = container.querySelector('p');
  if (emptyMsg) emptyMsg.remove();

  /*
    'beforeend' = insere como último filho do container.
    Outras opções: 'afterbegin' (primeiro filho),
    'beforebegin' (antes do container), 'afterend' (depois).
  */
  container.insertAdjacentHTML('beforeend', renderTopicCardHTML(topic));
}

/**
 * [LISTA] Remove UM card de tópico do DOM.
 *
 * element.remove() é a forma moderna de remover um elemento.
 * Não toca em nenhum outro card.
 *
 * Chamada quando: usuário confirma "Remover tópico".
 *
 * @param {number} topicId - ID do tópico a remover
 */
export function removeTopicCard(topicId) {
  const card = document.getElementById(`topic-${topicId}`);
  if (!card) return;

  /*
    Pequena animação de saída antes de remover do DOM.
    Usamos transition no CSS (opacity + transform) e
    depois de 250ms chamamos .remove() de verdade.
  */
  card.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
  card.style.opacity    = '0';
  card.style.transform  = 'translateX(-12px)';

  setTimeout(() => {
    card.remove();

    /* Se a lista ficou vazia, mostra a mensagem de estado vazio */
    const container = document.getElementById('topics-list');
    if (container && container.children.length === 0) {
      container.innerHTML = `
        <p style="text-align:center;padding:2rem;color:var(--text-muted);">
          Nenhum tópico ainda.
        </p>`;
    }
  }, 220); /* um pouco mais que a duração da transição */
}

/**
 * [LISTA] Insere UM subtópico novo no final da lista de subtópicos
 * de um tópico específico, sem recriar o card inteiro.
 *
 * Chamada quando: usuário confirma "Adicionar subtópico".
 *
 * @param {number} topicId - ID do tópico pai
 * @param {object} sub     - { id, text, done } do novo subtópico
 */
export function addSubtopicItem(topicId, sub) {
  /*
    Cada <ul> de subtópicos tem id="topic-X-subtopics"
    Isso foi definido em renderTopicCardHTML() acima.
  */
  const list = document.getElementById(`topic-${topicId}-subtopics`);
  if (!list) return;

  list.insertAdjacentHTML('beforeend', renderSubtopicHTML(sub, topicId));
}


/* ─────────────────────────────────────────────────────
   STREAK — calendário e botão
───────────────────────────────────────────────────── */

/**
 * Renderiza o mini calendário de 7 dias do card de streak.
 * Esta função recria o innerHTML do calendário — mas o calendário
 * tem apenas 7 elementos simples (sem estado), então é barato.
 *
 * @param {object} streak - { count, lastStudyDate, history[] }
 */
export function renderStreakCalendar(streak) {
  const calendar = document.getElementById('streak-calendar');
  if (!calendar) return;

  const history = streak.history || [];
  const now     = new Date();
  let html      = '';

  /*
    Gera os 7 dias: do mais antigo (6 dias atrás) até hoje (i=0).
    Para cada dia:
    - compara com o histórico para saber se o usuário estudou
    - aplica a classe CSS correta (is-done, is-today, ou nenhuma)
  */
  for (let i = 6; i >= 0; i--) {
    const d       = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10); /* "YYYY-MM-DD" */
    const studied = history.includes(dateStr);
    const isToday = i === 0;

    let cls = 'streak-day';
    if (isToday)      cls += ' is-today';
    else if (studied) cls += ' is-done';

    /* DAY_LABELS: ['D','S','T','Q','Q','S','S'] indexado pelo dia da semana */
    html += `<div class="${cls}" role="listitem">${DAY_LABELS[d.getDay()]}</div>`;
  }

  calendar.innerHTML = html;
}

/**
 * [PATCH] Atualiza o contador de streak e o estado do botão "Estudei hoje!".
 *
 * @param {object} streak  - objeto streak do appState
 * @param {string} todayStr - data de hoje no formato "YYYY-MM-DD"
 */
export function patchStreak(streak, todayStr) {
  /* Atualiza o número grande */
  const numEl = document.getElementById('streak-number');
  if (numEl) numEl.textContent = streak.count;

  /* Atualiza o calendário */
  renderStreakCalendar(streak);

  /* Atualiza o botão: desabilita se já registrou hoje */
  const btn        = document.getElementById('btn-streak');
  const todayDone  = streak.lastStudyDate === todayStr;
  if (btn) {
    btn.textContent   = todayDone ? '✔ Registrado hoje!' : '✔ Estudei hoje!';
    btn.disabled      = todayDone;
    btn.style.opacity = todayDone ? '0.5' : '1';
  }
}


/* ─────────────────────────────────────────────────────
   MODAIS — abrir e fechar
───────────────────────────────────────────────────── */

/**
 * Abre um modal removendo a classe 'hidden' e focando o primeiro input.
 * @param {string} modalId - ID do elemento modal
 */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('hidden');
  const input = modal.querySelector('input');
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 50);
  }
}

/**
 * Fecha um modal específico pelo ID.
 * @param {string} modalId
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('hidden');
  modal.querySelectorAll('input').forEach(i => i.value = '');
}

/**
 * Fecha TODOS os modais abertos de uma vez.
 * Usado ao pressionar ESC.
 */
export function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
}