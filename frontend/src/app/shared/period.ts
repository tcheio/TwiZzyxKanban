// `dateStr` est un horodatage complet (ex: "2026-01-08 10:00:00" ou "...T10:00:00.000Z") ;
// `from`/`to` sont des dates simples ("YYYY-MM-DD", ex: <input type="date">). On compare
// uniquement la partie date (10 premiers caractères), bornes incluses des deux côtés.
export function inPeriod(dateStr: string | null | undefined, from: string | null, to: string | null): boolean {
  if (!dateStr) return false;
  const date = dateStr.slice(0, 10);
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}
