// Palette fixe : les classes doivent apparaître littéralement quelque part dans le code
// scanné par Tailwind (JIT) pour ne pas être purgées du CSS final, d'où l'absence de
// concaténation dynamique de type `text-${color}-600`. La même liste de classes est
// dupliquée côté backend (backend/src/utils/rich-text.js) pour la sanitization.
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

export type RichTextCommand = 'bold' | 'italic' | 'strike' | 'code' | string;

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
    case 'code':
      wrapSelection(editor, 'code', CODE_CLASS);
      return;
    default:
      // Toute autre valeur est traitée comme une classe de couleur (cf. RICH_TEXT_COLORS).
      wrapSelection(editor, 'span', command);
  }
}
