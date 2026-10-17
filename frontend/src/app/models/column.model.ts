export interface Column {
  id: number;
  name: string;
  position: number;
  restricted?: boolean;
  // Les colonnes (du même kanban) qui partagent la même valeur non nulle sont affichées
  // imbriquées dans un seul emplacement du tableau (cf pages/board/board.ts).
  group_key?: string | null;
  created_at?: string;
}
