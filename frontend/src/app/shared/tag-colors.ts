const TAG_CLASSES = [
  'bg-sky-50 text-sky-700',
  'bg-emerald-50 text-emerald-700',
  'bg-violet-50 text-violet-700',
  'bg-amber-50 text-amber-700',
  'bg-rose-50 text-rose-700',
  'bg-indigo-50 text-indigo-700',
];

export function tagBadgeClass(tagId: number | null | undefined): string {
  if (!tagId) return '';
  return TAG_CLASSES[tagId % TAG_CLASSES.length];
}
