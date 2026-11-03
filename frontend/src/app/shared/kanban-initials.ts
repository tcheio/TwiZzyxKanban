// Initiales affichées dans le logo d'un kanban, déduites de son nom :
//   "TwiZzyx Kanban" → "TK", "Dev & Co" → "DC", "TwiZzyxKanban" → "TK" (camelCase),
//   "Minecraft" → "MI".
// On prend l'initiale du premier et du dernier mot (la ponctuation comme "&" est
// ignorée) ; un nom d'un seul mot est découpé sur ses majuscules internes, et à défaut
// on garde ses deux premières lettres.
export function kanbanInitials(name: string | null | undefined): string {
  const words = (name ?? '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.length === 0) return '?';

  const parts = words.length > 1 ? words : words[0].split(/(?<=\p{Ll})(?=\p{Lu})/u);
  const initials =
    parts.length > 1 ? parts[0].charAt(0) + parts[parts.length - 1].charAt(0) : parts[0].slice(0, 2);
  return initials.toUpperCase();
}
