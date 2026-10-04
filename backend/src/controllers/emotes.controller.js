const fs = require('fs');
const path = require('path');

// Les émotes sont les fichiers déposés dans frontend/public/emote (servis tels quels par
// Angular). On scanne ce dossier au lieu d'une liste codée en dur : ajouter/retirer un
// fichier suffit, aucune modification de code n'est nécessaire de part et d'autre.
const EMOTE_DIR = path.join(__dirname, '../../../frontend/public/emote');
// PNG uniquement (choix retenu au lieu du SVG). Garder webp/jpg/gif pour les autres formats
// bitmap plausibles, sans réintroduire le SVG.
const ALLOWED_EXTENSIONS = new Set(['.png', '.webp', '.jpg', '.jpeg', '.gif']);

function labelFromFilename(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s*svg\s*$/i, '')
    .trim();
}

function listEmoteFiles() {
  if (!fs.existsSync(EMOTE_DIR)) return [];
  return fs
    .readdirSync(EMOTE_DIR)
    .filter((name) => ALLOWED_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ path: `/emote/${name}`, label: labelFromFilename(name) }));
}

function list(req, res) {
  res.json(listEmoteFiles());
}

module.exports = { list, listEmoteFiles };
