// Le bg très clair (ex. bg-red-50) est peu lisible sur fond sombre : chaque couleur a donc
// sa propre variante dark: (fond teinté à faible opacité + texte plus clair) plutôt que de
// dépendre des jetons neutres (qui ne portent pas la teinte de la couleur choisie).
export const TAG_BADGE_CLASSES: Record<string, string> = {
  red: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  orange: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  gray: 'bg-surface-muted text-text-soft',
};

export const TAG_DOT_CLASSES: Record<string, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
  rose: 'bg-rose-500',
  indigo: 'bg-indigo-500',
  gray: 'bg-text-faint',
};

export const TAG_COLORS = Object.keys(TAG_BADGE_CLASSES);

export function tagBadgeClass(color: string | null | undefined): string {
  return (color && TAG_BADGE_CLASSES[color]) || TAG_BADGE_CLASSES['gray'];
}

export function tagDotClass(color: string | null | undefined): string {
  return (color && TAG_DOT_CLASSES[color]) || TAG_DOT_CLASSES['gray'];
}
