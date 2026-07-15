const KANBAN_TEMPLATES = {
  video: {
    columns: ['💡Idées', '📝Préparation/Écriture', '🎥Tournage', '🎬Montage', '🖼️Miniature', '✅Publié'],
    tags: ['Minecraft', 'Pokémon', 'Ykw Watch', 'Inazuma Eleven'],
    epics: [
      { name: 'TwiZzyx', color: 'red' },
      { name: 'TwiZzyxPasSympa', color: 'orange' },
      { name: 'Twitch', color: 'violet' },
    ],
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
