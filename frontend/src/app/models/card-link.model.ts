export type CardLinkType = 'before' | 'after';

export interface CardLink {
  id: number;
  card_id: number;
  linked_card_id: number;
  type: CardLinkType;
  created_at?: string;
}
