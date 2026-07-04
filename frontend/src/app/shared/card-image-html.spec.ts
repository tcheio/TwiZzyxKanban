import { describe, it, expect } from 'vitest';
import { stripCardImageSrc, hydrateCardImages } from './card-image-html';
import { CardImage } from '../models/card-image.model';

describe('card-image-html', () => {
  const images: CardImage[] = [
    { id: 1, card_id: 5, data_url: 'data:image/jpeg;base64,AAA' },
    { id: 2, card_id: 5, data_url: 'data:image/jpeg;base64,BBB' },
  ];

  it('stripCardImageSrc() retire le src et ne garde que le placeholder', () => {
    const html = '<p>Texte</p><img src="data:image/jpeg;base64,AAA" data-card-image-id="1" alt="" class="max-w-full rounded">';
    expect(stripCardImageSrc(html)).toBe('<p>Texte</p><img data-card-image-id="1" alt="">');
  });

  it('stripCardImageSrc() laisse intact un texte sans image', () => {
    expect(stripCardImageSrc('<p>Juste du texte</p>')).toBe('<p>Juste du texte</p>');
  });

  it('hydrateCardImages() réinjecte le bon data_url à partir du placeholder', () => {
    const html = '<p>Avant</p><img data-card-image-id="2" alt="">';
    expect(hydrateCardImages(html, images)).toBe(
      '<p>Avant</p><img src="data:image/jpeg;base64,BBB" data-card-image-id="2" alt="" class="max-w-full rounded">'
    );
  });

  it("hydrateCardImages() met un src vide si l'image référencée n'existe plus", () => {
    const html = '<img data-card-image-id="999" alt="">';
    expect(hydrateCardImages(html, images)).toBe('<img src="" data-card-image-id="999" alt="" class="max-w-full rounded">');
  });

  it('round-trip strip puis hydrate redonne le même rendu', () => {
    const original = '<img src="data:image/jpeg;base64,AAA" data-card-image-id="1" alt="" class="max-w-full rounded">';
    const stripped = stripCardImageSrc(original);
    expect(hydrateCardImages(stripped, images)).toBe(original);
  });
});
