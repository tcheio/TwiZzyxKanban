const KANBAN_TEMPLATES = {
  video: {
    // La colonne "Idées" est restreinte par défaut : seuls les modérateurs du kanban et
    // les personnes assignées à une carte peuvent la voir (cf utils/kanban-access.js).
    columns: [
      { name: '💡Idées', restricted: true },
      { name: '📝Préparation/Écriture' },
      { name: '🎥Tournage' },
      { name: '🎬Montage' },
      { name: '🖼️Miniature' },
      { name: '✅Publié' },
    ],
    tags: [
      { name: 'Minecraft', color: 'emerald' },
      { name: 'Pokémon', color: 'red' },
      { name: 'Ykw Watch', color: 'amber' },
      { name: 'Inazuma Eleven', color: 'sky' },
    ],
    epics: [],
  },
  basique: {
    columns: [{ name: 'À faire' }, { name: 'En cours' }, { name: 'Fait' }],
    tags: [],
    epics: [],
  },
};

const DEFAULT_TEMPLATE = 'video';

function isValidTemplate(template) {
  return Object.prototype.hasOwnProperty.call(KANBAN_TEMPLATES, template);
}

module.exports = { KANBAN_TEMPLATES, DEFAULT_TEMPLATE, isValidTemplate };
