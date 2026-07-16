export interface TicketSearchResult {
  id: number;
  title: string;
  key: string;
  kanban_code: string;
  kanban_name: string;
  column_name: string;
  cancelled: boolean;
}
