/* ─────────────────────────────────────────────────────
   state.js — Gestão de Dados e LocalStorage
───────────────────────────────────────────────────── */

export const STORAGE_KEY = 'devXodozada_v1';

/** Estado inicial padrão */
export function defaultState() {
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
      // ... (mantenha os outros tópicos iniciais aqui)
    ],
    streak: {
      count: 0,
      lastStudyDate: null,
      history: [],
    },
    avatar: null,
    nextTopicId: 4,
  };
}

/** Salva o estado no LocalStorage */
export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Carrega o estado e faz o merge com o padrão */
export function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultState();

    const parsed = JSON.parse(saved);
    return {
      ...defaultState(),
      ...parsed,
      streak: { ...defaultState().streak, ...(parsed.streak || {}) },
    };
  } catch {
    return defaultState();
  }
}