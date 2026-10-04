import { CardImage } from '../models/card-image.model';

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
