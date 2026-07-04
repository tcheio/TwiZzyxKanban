import { CardImage } from '../models/card-image.model';

/**
 * The description is fetched in bulk everywhere (board, tickets list, ticket detail's own
 * clone/link resolution), so images pasted into it are stored as a lightweight
 * `data-card-image-id` placeholder rather than an inline data URL. Comments are only ever
 * fetched per-ticket, so they embed the data URL directly and never go through this.
 */
const IMAGE_PLACEHOLDER_RE = /<img\b[^>]*data-card-image-id="(\d+)"[^>]*>/g;

export function stripCardImageSrc(html: string): string {
  return html.replace(IMAGE_PLACEHOLDER_RE, (_match, id: string) => `<img data-card-image-id="${id}" alt="">`);
}

export function hydrateCardImages(html: string, images: CardImage[]): string {
  return html.replace(IMAGE_PLACEHOLDER_RE, (_match, id: string) => {
    const src = images.find((image) => image.id === Number(id))?.data_url ?? '';
    return `<img src="${src}" data-card-image-id="${id}" alt="" class="max-w-full rounded">`;
  });
}
