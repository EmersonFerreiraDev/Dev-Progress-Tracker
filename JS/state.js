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

/**
 * Adiciona um novo tópico ao estado.
 * @param {object} state - O appState atual
 * @param {string} title - Nome do tópico
 */
export function addTopic(state, title) {
  const newTopic = {
    id: Date.now(),
    title: title,
    subtopics: []
  };
  state.topics.push(newTopic);
  saveState(state);
  return newTopic;
}

/**
 * Remove um tópico do estado pelo ID.
 * @param {object} state - O appState atual
 * @param {number} id - ID do tópico a remover
 */
export function removeTopic(state, id) {
  state.topics = state.topics.filter(t => t.id !== id);
  saveState(state);
}

/**
 * Remove um subtópico individual do array do tópico pai.
 *
 * Usamos filter() para criar um novo array sem o item removido.
 * filter() não muta o array original — cria um novo, o que é
 * mais seguro e previsível do que splice().
 *
 * @param {object} state      - appState completo
 * @param {number} topicId    - ID do tópico pai
 * @param {string} subtopicId - ID do subtópico a remover
 * @returns {object|null} o tópico atualizado, ou null se não encontrado
 */
export function removeSubtopic(state, topicId, subtopicId) {
  const topic = state.topics.find(t => t.id === topicId);
  if (!topic) return null;

  /* Filtra fora o subtópico com o ID correspondente */
  topic.subtopics = topic.subtopics.filter(s => s.id !== subtopicId);

  saveState(state);
  return topic; /* retorna o tópico para o main.js recalcular o progresso */
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