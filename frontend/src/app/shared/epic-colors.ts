export const EPIC_BADGE_CLASSES: Record<string, string> = {
  red: 'bg-red-50 text-red-700',
  orange: 'bg-orange-50 text-orange-700',
  amber: 'bg-amber-50 text-amber-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  sky: 'bg-sky-50 text-sky-700',
  violet: 'bg-violet-50 text-violet-700',
  rose: 'bg-rose-50 text-rose-700',
  indigo: 'bg-indigo-50 text-indigo-700',
  gray: 'bg-gray-100 text-gray-700',
};

export const EPIC_DOT_CLASSES: Record<string, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
  rose: 'bg-rose-500',
  indigo: 'bg-indigo-500',
  gray: 'bg-gray-400',
};

export const EPIC_COLORS = Object.keys(EPIC_BADGE_CLASSES);

export function epicBadgeClass(color: string | null | undefined): string {
  return (color && EPIC_BADGE_CLASSES[color]) || EPIC_BADGE_CLASSES['gray'];
}

export function epicDotClass(color: string | null | undefined): string {
  return (color && EPIC_DOT_CLASSES[color]) || EPIC_DOT_CLASSES['gray'];
}
