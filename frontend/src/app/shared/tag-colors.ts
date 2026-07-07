const TAG_CLASSES = [
  'bg-sky-50 text-sky-700',
  'bg-emerald-50 text-emerald-700',
  'bg-violet-50 text-violet-700',
  'bg-amber-50 text-amber-700',
  'bg-rose-50 text-rose-700',
  'bg-indigo-50 text-indigo-700',
];

// Couleur imposée pour certains tags par leur nom (plutôt que par id, qui dépend de
// l'ordre de création et n'est pas stable entre environnements).
const TAG_COLOR_OVERRIDES: Record<string, string> = {
  'Inazuma Eleven': 'bg-blue-50 text-blue-700',
};

export function tagBadgeClass(tagId: number | null | undefined, tagName?: string | null): string {
  if (!tagId) return '';
  if (tagName && TAG_COLOR_OVERRIDES[tagName]) return TAG_COLOR_OVERRIDES[tagName];
  return TAG_CLASSES[tagId % TAG_CLASSES.length];
}
