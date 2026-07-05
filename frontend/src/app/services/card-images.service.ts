import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CardImage } from '../models/card-image.model';
import { resizeImageToDataUrl } from '../shared/image-to-data-url';

@Injectable({ providedIn: 'root' })
export class CardImagesService {
  constructor(private readonly http: HttpClient) {}

  list(cardId: number): Promise<CardImage[]> {
    return firstValueFrom(this.http.get<CardImage[]>(`/api/cards/${cardId}/images`));
  }

  async upload(cardId: number, file: File): Promise<CardImage> {
    const dataUrl = await resizeImageToDataUrl(file, 1600, 0.85);
    return firstValueFrom(this.http.post<CardImage>(`/api/cards/${cardId}/images`, { data_url: dataUrl }));
  }

  remove(cardId: number, imageId: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/cards/${cardId}/images/${imageId}`));
  }
}
