const sanitizeHtml = require('sanitize-html');

// Cette liste doit rester alignée avec les classes utilisées par la toolbar de mise en
// forme du frontend (frontend/src/app/shared/rich-text.ts) : ce sont les seules classes
// que l'éditeur peut produire, tout le reste est donc considéré comme suspect.
const COLOR_CLASS_RE = /^text-(red|amber|green|blue|purple)-600$/;
const CODE_CLASSES = ['rounded', 'bg-gray-100', 'px-1', 'py-0.5', 'font-mono', 'text-sm', 'text-pink-600'];

const RICH_TEXT_OPTIONS = {
  allowedTags: ['b', 'strong', 'i', 'em', 's', 'strike', 'del', 'code', 'span', 'br', 'p', 'div', 'img'],
  allowedAttributes: {
    span: ['class'],
    code: ['class'],
    img: ['src', 'alt', 'class', 'data-card-image-id'],
  },
  allowedClasses: {
    span: [COLOR_CLASS_RE],
    code: CODE_CLASSES,
  },
  allowedSchemesByTag: { img: ['data', 'http', 'https'] },
  nonTextTags: ['style', 'script', 'textarea', 'option'],
};

function sanitizeRichText(html) {
  if (html === null || html === undefined) return html;
  return sanitizeHtml(html, RICH_TEXT_OPTIONS);
}

module.exports = { sanitizeRichText };
