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

// ---------------------------------------------------------------------------------------
// Primitives bas niveau : tout ce fichier passe par l'API Range/Selection standard, plus
// aucun `document.execCommand(...)` — cette API est obsolète, retirée des standards, et
// son comportement est mal spécifié et incohérent selon le navigateur et la taille du
// contenu éditable (observé en pratique : corruption d'une description longue lors de
// l'insertion d'un lien). Range/Selection est le remplacement standard, bien spécifié.
// ---------------------------------------------------------------------------------------

function activeRangeIn(editor: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  return editor.contains(range.commonAncestorContainer) ? range : null;
}

function findAncestor(node: Node, editor: HTMLElement, matches: (el: HTMLElement) => boolean): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== editor) {
    if (current instanceof HTMLElement && matches(current)) return current;
    current = current.parentNode;
  }
  return null;
}

// Retire un élément de l'arbre en gardant ses enfants à sa place (déplie une mise en
// forme déjà appliquée) — l'inverse de l'enveloppement fait par toggleWrap/wrapSelection.
function unwrap(el: HTMLElement): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

/**
 * Insère un nœud DOM à la position du curseur dans `editor` (en remplaçant la sélection
 * courante le cas échéant). Si aucun curseur valide n'est trouvé dans la zone éditable
 * (ex: focus perdu entre-temps), l'ajoute en fin de contenu plutôt que de risquer
 * d'écraser le contenu existant.
 */
export function insertNodeAtCursor(editor: HTMLElement, node: Node): void {
  const range = activeRangeIn(editor);
  if (range) {
    range.deleteContents();
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    editor.appendChild(node);
  }
}

// Bascule une mise en forme en ligne (gras/italique/souligné/barré/code) : si la
// sélection est déjà entièrement dans un ancêtre qui `matches`, le déplie (bascule OFF) ;
// sinon l'enveloppe dans `makeWrapper()` (bascule ON).
function toggleWrap(editor: HTMLElement, matches: (el: HTMLElement) => boolean, makeWrapper: () => HTMLElement): void {
  const range = activeRangeIn(editor);
  if (!range || range.collapsed) return;

  const selection = window.getSelection()!;
  const existing = findAncestor(range.commonAncestorContainer, editor, matches);
  if (existing) {
    unwrap(existing);
    selection.removeAllRanges();
    return;
  }

  const wrapper = makeWrapper();
  wrapper.appendChild(range.extractContents());
  range.insertNode(wrapper);

  selection.removeAllRanges();
  const after = document.createRange();
  after.selectNodeContents(wrapper);
  selection.addRange(after);
}

function isColorSpan(el: HTMLElement): boolean {
  return el.tagName === 'SPAN' && RICH_TEXT_COLORS.some((c) => el.classList.contains(c.className));
}

// Dédié (pas toggleWrap) : cliquer une couleur doit soit remplacer la couleur d'un
// ancêtre déjà coloré (pas l'imbriquer — sinon la couleur intérieure gagnerait en CSS et
// le changement semblerait ignoré), soit la retirer si c'est la même couleur qu'on
// reclique, soit en appliquer une nouvelle.
function applyColor(editor: HTMLElement, className: string): void {
  const range = activeRangeIn(editor);
  if (!range || range.collapsed) return;

  const selection = window.getSelection()!;
  const existing = findAncestor(range.commonAncestorContainer, editor, isColorSpan);
  if (existing) {
    if (existing.classList.contains(className)) {
      unwrap(existing);
    } else {
      existing.className = className;
    }
    selection.removeAllRanges();
    return;
  }

  const wrapper = document.createElement('span');
  wrapper.className = className;
  wrapper.appendChild(range.extractContents());
  range.insertNode(wrapper);

  selection.removeAllRanges();
  const after = document.createRange();
  after.selectNodeContents(wrapper);
  selection.addRange(after);
}

// Déplie tous les <li> d'une liste en les séparant par des <br> (préserve les sauts de
// ligne), puis retire la liste elle-même.
function unwrapList(list: HTMLElement): void {
  const parent = list.parentNode;
  if (!parent) return;
  const items = Array.from(list.children).filter((c): c is HTMLLIElement => c.tagName === 'LI');
  items.forEach((li, index) => {
    while (li.firstChild) parent.insertBefore(li.firstChild, list);
    if (index < items.length - 1) parent.insertBefore(document.createElement('br'), list);
  });
  parent.removeChild(list);
}

// Découpe les enfants d'un fragment extrait en lignes, sur chaque <br> rencontré.
function splitFragmentByBr(fragment: DocumentFragment): Node[][] {
  const lines: Node[][] = [[]];
  Array.from(fragment.childNodes).forEach((node) => {
    if (node.nodeName === 'BR') {
      lines.push([]);
    } else {
      lines[lines.length - 1].push(node);
    }
  });
  return lines;
}

// Liste à puces/numérotée : implémentation bornée au besoin réel de l'appli (descriptions
// et commentaires courts, pas un éditeur de document complet) plutôt qu'une réplication
// fidèle d'execCommand('insertUnorderedList'/'insertOrderedList') — dont aucune
// implémentation navigateur n'est de toute façon fiable à 100 %.
// - Sélection non vide : découpe le texte extrait sur les <br> et crée un <li> par ligne.
// - Curseur simple (pas de sélection) : démarre un nouvel item de liste vide à cet endroit
//   (ne "liste-ifie" pas rétroactivement la ligne en cours — simplification assumée).
// - Si le curseur/la sélection est déjà dans un <li> : bascule OFF (déplie toute la liste).
function applyList(editor: HTMLElement, tagName: 'UL' | 'OL'): void {
  const range = activeRangeIn(editor);
  if (!range) return;

  const selection = window.getSelection()!;
  const existingItem = findAncestor(range.commonAncestorContainer, editor, (el) => el.tagName === 'LI');
  if (existingItem) {
    const list = existingItem.closest('ul, ol');
    if (list instanceof HTMLElement) unwrapList(list);
    selection.removeAllRanges();
    return;
  }

  const list = document.createElement(tagName);

  if (range.collapsed) {
    const li = document.createElement('li');
    range.insertNode(list);
    list.appendChild(li);
  } else {
    const fragment = range.extractContents();
    splitFragmentByBr(fragment).forEach((nodes) => {
      const li = document.createElement('li');
      if (nodes.length === 0) {
        li.appendChild(document.createElement('br'));
      } else {
        nodes.forEach((n) => li.appendChild(n));
      }
      list.appendChild(li);
    });
    range.insertNode(list);
  }

  selection.removeAllRanges();
  const after = document.createRange();
  after.selectNodeContents(list);
  after.collapse(false);
  selection.addRange(after);
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

export interface LinkifiedPaste {
  href: string;
  label: string;
}

/**
 * Si le texte collé est entièrement une URL, renvoie {href, label} prêt à être inséré
 * comme `<a>` via `insertLinkAtCursor` ; sinon `null`, pour laisser le collage suivre son
 * cours normal.
 */
export function linkifyPastedUrl(text: string): LinkifiedPaste | null {
  const trimmed = text.trim();
  if (!STANDALONE_URL_RE.test(trimmed)) return null;
  const url = normalizeLinkUrl(trimmed);
  if (!url) return null;
  return { href: url, label: trimmed };
}

/** Insère un lien à la position du curseur dans `editor` (cf insertNodeAtCursor). */
export function insertLinkAtCursor(editor: HTMLElement, link: LinkifiedPaste): void {
  const anchor = document.createElement('a');
  anchor.href = link.href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.textContent = link.label;
  insertNodeAtCursor(editor, anchor);
}

// Transforme le texte sélectionné (bouton "Lien" de la toolbar) en lien cliquable, en
// conservant sa mise en forme interne (ex: du texte en gras reste en gras à l'intérieur
// du lien).
function insertLink(editor: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
  if (!editor.contains(selection.getRangeAt(0).commonAncestorContainer)) return;

  // window.prompt() est une boîte de dialogue native bloquante : le temps qu'elle est
  // affichée, la zone éditable perd le focus — et dans la plupart des navigateurs, sa
  // sélection avec. On la sauvegarde donc avant d'ouvrir le prompt, pour la restaurer
  // explicitement avant de construire le lien.
  const savedRange = selection.getRangeAt(0).cloneRange();

  const raw = window.prompt('Adresse du lien (https://...)');
  if (raw === null) return;
  const url = normalizeLinkUrl(raw);
  if (!url) return;

  editor.focus();
  const restored = window.getSelection();
  if (!restored) return;

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.appendChild(savedRange.extractContents());
  savedRange.insertNode(anchor);

  restored.removeAllRanges();
  const after = document.createRange();
  after.setStartAfter(anchor);
  after.collapse(true);
  restored.addRange(after);
}

/** Applique une commande de mise en forme dans un `contenteditable` sur la sélection courante. */
export function applyRichTextCommand(editor: HTMLElement, command: RichTextCommand): void {
  editor.focus();
  switch (command) {
    case 'bold':
      toggleWrap(editor, (el) => el.tagName === 'STRONG', () => document.createElement('strong'));
      return;
    case 'italic':
      toggleWrap(editor, (el) => el.tagName === 'EM', () => document.createElement('em'));
      return;
    case 'strike':
      toggleWrap(editor, (el) => el.tagName === 'S', () => document.createElement('s'));
      return;
    case 'underline':
      toggleWrap(editor, (el) => el.tagName === 'U', () => document.createElement('u'));
      return;
    case 'ul':
      applyList(editor, 'UL');
      return;
    case 'ol':
      applyList(editor, 'OL');
      return;
    case 'link':
      insertLink(editor);
      return;
    case 'code':
      toggleWrap(
        editor,
        (el) => el.tagName === 'CODE',
        () => {
          const code = document.createElement('code');
          code.className = CODE_CLASS;
          return code;
        }
      );
      return;
    default:
      // Toute autre valeur est traitée comme une classe de couleur (cf. RICH_TEXT_COLORS).
      applyColor(editor, command);
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
