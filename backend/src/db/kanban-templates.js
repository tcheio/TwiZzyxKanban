const KANBAN_TEMPLATES = {
  video: {
    columns: ['💡Idées', '📝Préparation/Écriture', '🎥Tournage', '🎬Montage', '🖼️Miniature', '✅Publié'],
    tags: [
      { name: 'Minecraft', color: 'emerald' },
      { name: 'Pokémon', color: 'red' },
      { name: 'Ykw Watch', color: 'amber' },
      { name: 'Inazuma Eleven', color: 'sky' },
    ],
    epics: [],
  },
  basique: {
    columns: ['À faire', 'En cours', 'Fait'],
    tags: [],
    epics: [],
  },
};

const DEFAULT_TEMPLATE = 'video';

function isValidTemplate(template) {
  return Object.prototype.hasOwnProperty.call(KANBAN_TEMPLATES, template);
}

module.exports = { KANBAN_TEMPLATES, DEFAULT_TEMPLATE, isValidTemplate };
