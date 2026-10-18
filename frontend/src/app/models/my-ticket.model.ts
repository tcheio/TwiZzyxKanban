import { Priority } from './card.model';

// Ticket dont l'utilisateur courant est responsable (principal ou additionnel), tous
// kanbans confondus — cf backend/src/controllers/me.controller.js::myTickets. N'inclut
// que les champs utiles au widget "Mes tickets" de la page d'accueil, pas la forme
// complète de `Card` (pas de tag_id/epic_id/etc.).
export interface MyTicket {
  id: number;
  key: string;
  title: string;
  priority: Priority;
  due_date: string | null;
  created_at: string;
  kanban_code: string;
  kanban_name: string;
  column_name: string;
}
