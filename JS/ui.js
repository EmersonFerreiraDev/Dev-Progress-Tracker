import { calcTopicProgress, calcLevel, DAY_LABELS } from './utils.js';

export function announce(msg) {
  const el = document.getElementById('sr-announcer');
  if (el) el.textContent = msg;
}

function renderSubtopicHTML(sub, topicId) {
  return `
    <li class="subtopic-item" id="sub-${sub.id}" role="listitem">
      <label class="subtopic-label">
        <input type="checkbox" class="subtopic-check"
          data-topic-id="${topicId}"
          data-subtopic-id="${sub.id}"
          ${sub.done ? 'checked' : ''} />
        <span class="check-custom" aria-hidden="true"></span>
        <span class="subtopic-text">${sub.text}</span>
      </label>
      <button
        class="btn-del-sub"
        data-action="remove-subtopic"
        data-topic-id="${topicId}"
        data-subtopic-id="${sub.id}"
        aria-label="Remover subtópico ${sub.text}"
        title="Remover subtópico"
      >✕</button>
    </li>`;
}

export function renderTopicCardHTML(topic) {
  const { done, total, pct } = calcTopicProgress(topic);
  const complete = pct === 100;
  const subsHTML = topic.subtopics.map(s => renderSubtopicHTML(s, topic.id)).join('');

  return `
    <article class="topic-card" id="topic-${topic.id}" data-topic-id="${topic.id}">
      <header class="topic-header">
        <div class="topic-title-group">
          <span class="topic-status-dot ${complete ? 'is-complete' : ''}" id="topic-${topic.id}-dot"></span>
          <h3 class="topic-title" id="topic-${topic.id}-title">${topic.title}</h3>
        </div>
        <div class="topic-progress-mini">
          <span class="topic-progress-text" id="topic-${topic.id}-progress">${done}/${total}</span>
          <div class="topic-bar-track">
            <div class="topic-bar-fill ${complete ? 'is-complete' : ''}" id="topic-${topic.id}-bar" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="topic-actions">
          <button class="btn-icon btn-edit" data-action="edit-topic" data-target="topic-${topic.id}" title="Editar">✎</button>
          <button class="btn-icon btn-remove" data-action="remove-topic" data-target="topic-${topic.id}" title="Remover">✕</button>
        </div>
      </header>
      <ul class="subtopics-list" id="topic-${topic.id}-subtopics">${subsHTML}</ul>
      <footer class="topic-footer">
        <button class="btn-add-sub" data-action="add-subtopic" data-target="topic-${topic.id}">＋ Adicionar subtópico</button>
      </footer>
    </article>`;
}

export function renderAll(state) {
  const container = document.getElementById('topics-list');
  if (container) {
    container.innerHTML = state.topics.length > 0
      ? state.topics.map(renderTopicCardHTML).join('')
      : `<p style="text-align:center;padding:2rem;color:#333;">Nenhum tópico ainda.</p>`;
  }
  patchHeader(state.globalPct);
  const numStreak = document.getElementById('streak-number');
  if (numStreak) numStreak.textContent = state.streak.count;
  renderStreakCalendar(state.streak);
  patchAvatar(state.avatar);
}

export function patchTopicProgress(topicId, done, total, pct) {
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

export function patchTopicTitle(topicId, newTitle) {
  const el = document.getElementById(`topic-${topicId}-title`);
  if (el) el.textContent = newTitle;
}

export function patchHeader(pct) {
  const fill = document.getElementById('progress-bar-fill');
  if (fill) fill.style.width = `${pct}%`;
  const pctEl = document.getElementById('progress-percent');
  if (pctEl) pctEl.textContent = `${pct}%`;
  const track = document.getElementById('progress-bar-track');
  if (track) track.setAttribute('aria-valuenow', pct);
  const level = calcLevel(pct);
  const numEl = document.getElementById('level-number');
  if (numEl) numEl.textContent = level.number;
  const titleEl = document.getElementById('level-title');
  if (titleEl) titleEl.textContent = level.title;
}

export function patchStats(done, pending) {
  const doneEl    = document.getElementById('stat-topics-done');
  const pendingEl = document.getElementById('stat-topics-pending');
  if (doneEl)    doneEl.textContent    = done;
  if (pendingEl) pendingEl.textContent = pending;
  patchDonut(done, done + pending);
}

export function patchDonut(done, total) {
  const fill  = document.getElementById('donut-fill-topics');
  const label = document.getElementById('donut-label-topics');
  if (!fill || !label) return;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  fill.setAttribute('stroke-dasharray', `${pct} ${100 - pct}`);
  label.textContent = `${pct}%`;
}

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

export function addTopicCard(topic) {
  const container = document.getElementById('topics-list');
  if (!container) return;
  const emptyMsg = container.querySelector('p');
  if (emptyMsg) emptyMsg.remove();
  container.insertAdjacentHTML('beforeend', renderTopicCardHTML(topic));
}

export function removeTopicCard(topicId) {
  const card = document.getElementById(`topic-${topicId}`);
  if (!card) return;
  card.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
  card.style.opacity    = '0';
  card.style.transform  = 'translateX(-8px)';
  setTimeout(() => {
    card.remove();
    const container = document.getElementById('topics-list');
    if (container && container.children.length === 0) {
      container.innerHTML = `<p style="text-align:center;padding:2rem;color:#333;">Nenhum tópico ainda.</p>`;
    }
  }, 160);
}

export function addSubtopicItem(topicId, sub) {
  const list = document.getElementById(`topic-${topicId}-subtopics`);
  if (!list) return;
  list.insertAdjacentHTML('beforeend', renderSubtopicHTML(sub, topicId));
}

export function renderStreakCalendar(streak) {
  const calendar = document.getElementById('streak-calendar');
  if (!calendar) return;
  const history = streak.history || [];
  const now     = new Date();
  let html      = '';
  for (let i = 6; i >= 0; i--) {
    const d       = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const studied = history.includes(dateStr);
    const isToday = i === 0;
    let cls = 'streak-day';
    if (isToday)      cls += ' is-today';
    else if (studied) cls += ' is-done';
    html += `<div class="${cls}" role="listitem">${DAY_LABELS[d.getDay()]}</div>`;
  }
  calendar.innerHTML = html;
}

export function patchStreak(streak, todayStr) {
  const numEl = document.getElementById('streak-number');
  if (numEl) numEl.textContent = streak.count;
  renderStreakCalendar(streak);
  const btn       = document.getElementById('btn-streak');
  const todayDone = streak.lastStudyDate === todayStr;
  if (btn) {
    btn.textContent   = todayDone ? '✔ Registrado hoje!' : '✔ Estudei hoje!';
    btn.disabled      = todayDone;
    btn.style.opacity = todayDone ? '0.4' : '1';
  }
}

export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('hidden');
  const input = modal.querySelector('input');
  if (input) { input.value = ''; setTimeout(() => input.focus(), 50); }
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('hidden');
  modal.querySelectorAll('input').forEach(i => i.value = '');
}

export function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
}