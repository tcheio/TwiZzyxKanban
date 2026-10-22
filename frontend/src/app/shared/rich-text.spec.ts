import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyRichTextCommand, insertNodeAtCursor, insertLinkAtCursor } from './rich-text';

function setText(editor: HTMLElement, text: string): void {
  editor.textContent = text;
}

function selectRange(editor: HTMLElement, start: number, end: number): void {
  const textNode = editor.firstChild as Text;
  const range = document.createRange();
  range.setStart(textNode, start);
  range.setEnd(textNode, end);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

function selectElementContents(el: Element): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

describe('rich-text', () => {
  let editor: HTMLDivElement;

  beforeEach(() => {
    editor = document.createElement('div');
    document.body.appendChild(editor);
  });

  afterEach(() => {
    editor.remove();
    vi.restoreAllMocks();
  });

  describe.each([
    ['bold', 'strong'],
    ['italic', 'em'],
    ['underline', 'u'],
    ['strike', 's'],
  ] as const)('%s (toggleWrap)', (command, tag) => {
    it(`enveloppe la sélection dans <${tag}>`, () => {
      setText(editor, 'Avant texte après');
      selectRange(editor, 6, 11); // "texte"

      applyRichTextCommand(editor, command);

      expect(editor.innerHTML).toBe(`Avant <${tag}>texte</${tag}> après`);
    });

    it('un second passage sur le même texte retire la mise en forme (bascule OFF)', () => {
      setText(editor, 'Avant texte après');
      selectRange(editor, 6, 11);
      applyRichTextCommand(editor, command);

      selectElementContents(editor.querySelector(tag)!);
      applyRichTextCommand(editor, command);

      expect(editor.innerHTML).toBe('Avant texte après');
    });

    it('ne fait rien sans sélection (évite de planter sur un simple clic)', () => {
      setText(editor, 'Avant texte après');
      window.getSelection()?.removeAllRanges();

      applyRichTextCommand(editor, command);

      expect(editor.innerHTML).toBe('Avant texte après');
    });
  });

  describe('code', () => {
    it("enveloppe la sélection dans <code> avec la classe partagée avec le backend", () => {
      setText(editor, 'const x = 1');
      selectRange(editor, 6, 7); // "x"

      applyRichTextCommand(editor, 'code');

      const code = editor.querySelector('code');
      expect(code?.textContent).toBe('x');
      expect(code?.className).toContain('font-mono');
    });

    it('bascule OFF sur un second passage', () => {
      setText(editor, 'const x = 1');
      selectRange(editor, 6, 7);
      applyRichTextCommand(editor, 'code');

      selectElementContents(editor.querySelector('code')!);
      applyRichTextCommand(editor, 'code');

      expect(editor.querySelector('code')).toBeNull();
      expect(editor.textContent).toBe('const x = 1');
    });
  });

  describe('couleurs', () => {
    it('enveloppe la sélection dans un span coloré', () => {
      setText(editor, 'Avant texte après');
      selectRange(editor, 6, 11);

      applyRichTextCommand(editor, 'text-red-600');

      expect(editor.innerHTML).toBe('Avant <span class="text-red-600">texte</span> après');
    });

    it("cliquer une autre couleur remplace la couleur existante (ne l'imbrique pas)", () => {
      setText(editor, 'Avant texte après');
      selectRange(editor, 6, 11);
      applyRichTextCommand(editor, 'text-red-600');

      selectElementContents(editor.querySelector('span')!);
      applyRichTextCommand(editor, 'text-green-600');

      expect(editor.innerHTML).toBe('Avant <span class="text-green-600">texte</span> après');
    });

    it('recliquer la même couleur la retire (bascule OFF)', () => {
      setText(editor, 'Avant texte après');
      selectRange(editor, 6, 11);
      applyRichTextCommand(editor, 'text-red-600');

      selectElementContents(editor.querySelector('span')!);
      applyRichTextCommand(editor, 'text-red-600');

      expect(editor.innerHTML).toBe('Avant texte après');
    });
  });

  describe('listes (ul/ol)', () => {
    it('sélection multi-lignes : un <li> par ligne (découpage sur les <br>)', () => {
      editor.innerHTML = 'Ligne 1<br>Ligne 2<br>Ligne 3';
      selectElementContents(editor);

      applyRichTextCommand(editor, 'ul');

      const list = editor.querySelector('ul')!;
      expect(Array.from(list.children).map((li) => li.textContent)).toEqual(['Ligne 1', 'Ligne 2', 'Ligne 3']);
    });

    it('curseur simple (éditeur vide) : démarre un nouvel item de liste vide', () => {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(true);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);

      applyRichTextCommand(editor, 'ol');

      expect(editor.querySelector('ol > li')).toBeTruthy();
    });

    it('rebasculer dans un item de liste existant retire toute la liste (bascule OFF)', () => {
      editor.innerHTML = 'Ligne 1<br>Ligne 2';
      selectElementContents(editor);
      applyRichTextCommand(editor, 'ul');

      selectElementContents(editor.querySelector('li')!);
      applyRichTextCommand(editor, 'ul');

      expect(editor.innerHTML).toBe('Ligne 1<br>Ligne 2');
    });
  });

  describe('lien (bouton toolbar "Lien")', () => {
    function selectWord(word: string): void {
      const textNode = editor.firstChild as Text;
      const start = (textNode.textContent ?? '').indexOf(word);
      const range = document.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, start + word.length);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    }

    beforeEach(() => {
      setText(editor, 'Avant texte sélectionné après');
    });

    it(
      "restaure la sélection perdue pendant window.prompt() : le lien s'applique au texte " +
        "choisi, pas à une sélection vide/perdue (window.prompt() fait perdre le focus, " +
        'et dans la plupart des navigateurs la sélection, à la zone éditable, le temps ' +
        "qu'il est affiché)",
      () => {
        selectWord('sélectionné');
        vi.spyOn(window, 'prompt').mockImplementation(() => {
          window.getSelection()?.removeAllRanges();
          return 'exemple.com';
        });

        applyRichTextCommand(editor, 'link');

        const anchor = editor.querySelector('a')!;
        expect(anchor.getAttribute('href')).toBe('https://exemple.com/');
        expect(anchor.target).toBe('_blank');
        expect(anchor.rel).toBe('noopener noreferrer');
        expect(anchor.textContent).toBe('sélectionné');
        expect(editor.textContent).toBe('Avant texte sélectionné après');
      }
    );

    it("ne fait rien si rien n'est sélectionné (pas de boîte de dialogue)", () => {
      const promptSpy = vi.spyOn(window, 'prompt');
      window.getSelection()?.removeAllRanges();

      applyRichTextCommand(editor, 'link');

      expect(promptSpy).not.toHaveBeenCalled();
    });

    it("n'insère pas de lien si la boîte de dialogue est annulée", () => {
      selectWord('sélectionné');
      vi.spyOn(window, 'prompt').mockReturnValue(null);

      applyRichTextCommand(editor, 'link');

      expect(editor.querySelector('a')).toBeNull();
    });
  });

  describe('insertNodeAtCursor', () => {
    it('insère le nœud à la position du curseur', () => {
      setText(editor, 'Avant après');
      selectRange(editor, 6, 6);

      insertNodeAtCursor(editor, document.createTextNode('MILIEU '));

      expect(editor.textContent).toBe('Avant MILIEU après');
    });

    it("ajoute en fin de contenu si aucun curseur valide n'est trouvé dans editor", () => {
      setText(editor, 'Avant');
      window.getSelection()?.removeAllRanges();

      insertNodeAtCursor(editor, document.createTextNode(' après'));

      expect(editor.textContent).toBe('Avant après');
    });
  });

  describe('insertLinkAtCursor (collage automatique d\'URL)', () => {
    it('insère un lien cliquable à la position du curseur, sans toucher au reste du texte', () => {
      setText(editor, 'Avant après');
      selectRange(editor, 6, 6);

      insertLinkAtCursor(editor, { href: 'https://exemple.com/', label: 'https://exemple.com' });

      expect(editor.innerHTML).toBe(
        'Avant <a href="https://exemple.com/" target="_blank" rel="noopener noreferrer">https://exemple.com</a>après'
      );
    });
  });
});
