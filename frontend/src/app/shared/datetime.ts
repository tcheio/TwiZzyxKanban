export function parseUtcDateTime(dateStr: string): Date {
  const iso = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  return new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

// "DD-MM-YYYY à HH:MM", en heure locale du navigateur.
export function formatDateTime(dateStr: string): string {
  const date = parseUtcDateTime(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  return `${day}-${month}-${date.getFullYear()} à ${hours}:${minutes}`;
}

// "DD/MM à HH:MM" (format court, ex: liste de notifications), en heure locale du navigateur.
export function formatShortDateTime(dateStr: string): string {
  const date = parseUtcDateTime(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  return `${day}/${month} à ${hours}:${minutes}`;
}
