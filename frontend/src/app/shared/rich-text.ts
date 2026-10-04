export interface RichTextColor {
  label: string;
  className: string;
  swatchClass: string;
}

export const RICH_TEXT_COLORS: RichTextColor[] = [
  { label: 'Rouge', className: 'text-red-600', swatchClass: 'bg-red-600' },
  { label: 'Orange', className: 'text-amber-600', swatchClass: 'bg-amber-600' },
  { label: 'Vert', className: 'text-green-600', swatchClass: 'bg-green-600' },
  { label: 'Bleu', className: 'text-blue-600', swatchClass: 'bg-blue-600' },
  { label: 'Violet', className: 'text-purple-600', swatchClass: 'bg-purple-600' },
];

export const CODE_CLASS = 'rounded bg-gray-100 px-1 py-0.5 font-mono text-sm text-pink-600';

export type RichTextCommand = 'bold' | 'italic' | 'strike' | 'underline' | 'code' | 'link' | 'ul' | 'ol' | string;

function wrapSelection(editor: HTMLElement, tagName: string, className: string): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return false;

  const wrapper = document.createElement(tagName);
  wrapper.className = className;
  wrapper.appendChild(range.extractContents());
  range.insertNode(wrapper);

  selection.removeAllRanges();
  const after = document.createRange();
  after.setStartAfter(wrapper);
  after.collapse(true);
  selection.addRange(after);
  return true;
}

// N'accepte que http(s)/mailto, et ajoute "https://" par défaut si l'utilisateur n'a
// saisi qu'un nom de domaine (ex. "exemple.com") : évite les URLs "javascript:" et
// autres schémas dangereux, en plus du filtrage fait côté backend à l'enregistrement.
function normalizeLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^mailto:/i.test(trimmed)) return trimmed;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}

// Ne matche que si le texte collé est *entièrement* une URL (rien d'autre autour) : on
// évite ainsi de transformer par erreur un mot ordinaire contenant un point au milieu
// d'une phrase collée.
const STANDALONE_URL_RE = /^(?:https?:\/\/\S+|www\.\S+|mailto:\S+)$/i;

function escapeHtmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Si le texte collé est entièrement une URL, renvoie le HTML du lien correspondant
 * (prêt à insérer via `execCommand('insertHTML', ...)`) ; sinon `null`, pour laisser le
 * collage suivre son cours normal.
 */
export function linkifyPastedUrl(text: string): string | null {
  const trimmed = text.trim();
  if (!STANDALONE_URL_RE.test(trimmed)) return null;
  const url = normalizeLinkUrl(trimmed);
  if (!url) return null;
  const href = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(trimmed)}</a>`;
}

function findAnchorInSelection(editor: HTMLElement): HTMLAnchorElement | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  let node: Node | null = selection.getRangeAt(0).startContainer;
  while (node && node !== editor) {
    if (node instanceof HTMLAnchorElement) return node;
    node = node.parentNode;
  }
  return null;
}

function insertLink(editor: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
  if (!editor.contains(selection.getRangeAt(0).commonAncestorContainer)) return;

  const raw = window.prompt('Adresse du lien (https://...)');
  if (raw === null) return;
  const url = normalizeLinkUrl(raw);
  if (!url) return;

  document.execCommand('createLink', false, url);
  const anchor = findAnchorInSelection(editor);
  if (anchor) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
}

/** Applique une commande de mise en forme dans un `contenteditable` sur la sélection courante. */
export function applyRichTextCommand(editor: HTMLElement, command: RichTextCommand): void {
  editor.focus();
  switch (command) {
    case 'bold':
      document.execCommand('bold');
      return;
    case 'italic':
      document.execCommand('italic');
      return;
    case 'strike':
      document.execCommand('strikeThrough');
      return;
    case 'underline':
      document.execCommand('underline');
      return;
    case 'ul':
      document.execCommand('insertUnorderedList');
      return;
    case 'ol':
      document.execCommand('insertOrderedList');
      return;
    case 'link':
      insertLink(editor);
      return;
    case 'code':
      wrapSelection(editor, 'code', CODE_CLASS);
      return;
    default:
      // Toute autre valeur est traitée comme une classe de couleur (cf. RICH_TEXT_COLORS).
      wrapSelection(editor, 'span', command);
  }
}

/**
 * Ouvre dans un nouvel onglet le lien cliqué à l'intérieur d'une zone `contenteditable`
 * (par défaut, un clic simple y place juste le curseur au lieu de naviguer).
 */
export function openRichTextLinkOnClick(event: MouseEvent): void {
  const anchor = (event.target as HTMLElement).closest('a[href]');
  if (anchor instanceof HTMLAnchorElement) {
    event.preventDefault();
    window.open(anchor.href, '_blank', 'noopener,noreferrer');
  }
}
