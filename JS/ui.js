/* ─────────────────────────────────────────────────────
   ui.js — Renderização e Manipulação do DOM
───────────────────────────────────────────────────── */
import { calcTopicProgress, calcLevel, DAY_LABELS } from './utils.js';

/** Anuncia mensagem para leitores de tela */
export function announce(msg) {
  const el = document.getElementById('sr-announcer');
  if (el) el.textContent = msg;
}

/** Gera HTML de um subtópico */
function renderSubtopicHTML(sub, topicId) {
  return `
    <li class="subtopic-item" role="listitem">
      <label class="subtopic-label">
        <input type="checkbox" class="subtopic-check" 
          data-topic-id="${topicId}" data-subtopic-id="${sub.id}"
          ${sub.done ? 'checked' : ''} />
        <span class="check-custom" aria-hidden="true"></span>
        <span class="subtopic-text">${sub.text}</span>
      </label>
    </li>`;
}

/** Gera HTML de um card de tópico */
export function renderTopicCardHTML(topic) {
  const { done, total, pct } = calcTopicProgress(topic);
  const complete = pct === 100;
  const subsHTML = topic.subtopics.map(s => renderSubtopicHTML(s, topic.id)).join('');

  return `
    <article class="topic-card" id="topic-${topic.id}" data-topic-id="${topic.id}">
      <header class="topic-header">
        <div class="topic-title-group">
          <span class="topic-status-dot ${complete ? 'is-complete' : ''}" id="topic-${topic.id}-dot"></span>
          <h3 class="topic-title">${topic.title}</h3>
        </div>
        <div class="topic-progress-mini">
          <span class="topic-progress-text" id="topic-${topic.id}-progress">${done}/${total}</span>
          <div class="topic-bar-track">
            <div class="topic-bar-fill ${complete ? 'is-complete' : ''}" 
                 id="topic-${topic.id}-bar" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="topic-actions">
          <button class="btn-icon" data-action="edit-topic" data-target="topic-${topic.id}">✎</button>
          <button class="btn-icon" data-action="remove-topic" data-target="topic-${topic.id}">✕</button>
        </div>
      </header>
      <ul class="subtopics-list">${subsHTML}</ul>
      <footer class="topic-footer">
        <button class="btn-add-sub" data-action="add-subtopic" data-target="topic-${topic.id}">＋ Adicionar subtópico</button>
      </footer>
    </article>`;
}

/** Renderiza tudo na tela */
export function renderAll(state) {
  // Render Topics
  const container = document.getElementById('topics-list');
  if (container) {
    container.innerHTML = state.topics.length > 0 
      ? state.topics.map(renderTopicCardHTML).join('')
      : '<p style="text-align:center; padding:2rem; color:var(--text-muted);">Nenhum tópico ainda.</p>';
  }

  // Render Header (Progresso Global)
  const pct = state.globalPct; // Vamos calcular isso no main
  const level = calcLevel(pct);
  
  const fill = document.getElementById('progress-bar-fill');
  if (fill) fill.style.width = `${pct}%`;
  
  const numEl = document.getElementById('level-number');
  if (numEl) numEl.textContent = level.number;

  const titleEl = document.getElementById('level-title');
  if (titleEl) titleEl.textContent = level.title;

  // Render Streak
  const numStreak = document.getElementById('streak-number');
  if (numStreak) numStreak.textContent = state.streak.count;

  // Render Avatar
  const img = document.getElementById('avatar-img');
  const placeholder = document.getElementById('avatar-placeholder');
  if (img && placeholder) {
    if (state.avatar) {
      img.src = state.avatar;
      img.classList.remove('hidden');
      placeholder.style.display = 'none';
    } else {
      img.classList.add('hidden');
      placeholder.style.display = '';
    }
  }
}

/** Controle de Modais */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('hidden');
  const input = modal.querySelector('input');
  if (input) { input.value = ''; setTimeout(() => input.focus(), 50); }
}

export function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
}