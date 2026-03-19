/* ─────────────────────────────────────────────────────
   utils.js — Cálculos, Datas e Geradores
───────────────────────────────────────────────────── */

/** Abreviações dos dias da semana */
export const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Mapeamento de progresso → level (RPG) */
export const LEVELS = [
  { min: 0,  max: 20,  number: 1, title: 'Beginner'  },
  { min: 20, max: 40,  number: 2, title: 'Explorer'  },
  { min: 40, max: 60,  number: 3, title: 'Developer' },
  { min: 60, max: 80,  number: 4, title: 'Builder'   },
  { min: 80, max: 101, number: 5, title: 'Master'    },
];

/** Retorna a data de hoje formatada YYYY-MM-DD */
export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Gera ID único para subtópicos */
export function genSubId(topicId) {
  return `${topicId}-${Date.now()}`;
}

/** Cálculos de Progresso */
export function calcTopicProgress(topic) {
  const total = topic.subtopics.length;
  const done  = topic.subtopics.filter(s => s.done).length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, pct };
}

export function calcGlobalProgress(topics) {
  let total = 0;
  let done  = 0;
  topics.forEach(t => {
    total += t.subtopics.length;
    done  += t.subtopics.filter(s => s.done).length;
  });
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/** Determina o level atual */
export function calcLevel(pct) {
  return LEVELS.find(l => pct >= l.min && pct < l.max) || LEVELS[LEVELS.length - 1];
}