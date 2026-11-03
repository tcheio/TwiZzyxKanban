// Fond du logo d'un kanban (carré aux initiales), selon la couleur choisie dans les
// paramètres du tableau. Même palette que les tags/EPICs (backend/src/constants/colors.js),
// en teinte soutenue pour rester lisible sous des initiales blanches.
export const KANBAN_LOGO_CLASSES: Record<string, string> = {
  red: 'bg-red-600',
  orange: 'bg-orange-600',
  amber: 'bg-amber-600',
  emerald: 'bg-emerald-600',
  sky: 'bg-sky-600',
  violet: 'bg-violet-600',
  rose: 'bg-rose-600',
  indigo: 'bg-indigo-600',
  gray: 'bg-gray-600',
};

export const KANBAN_COLOR_LABELS: Record<string, string> = {
  red: 'Rouge',
  orange: 'Orange',
  amber: 'Ambre',
  emerald: 'Vert',
  sky: 'Bleu ciel',
  violet: 'Violet',
  rose: 'Rose',
  indigo: 'Indigo',
  gray: 'Gris',
};

export const KANBAN_COLORS = Object.keys(KANBAN_LOGO_CLASSES);

export const DEFAULT_KANBAN_COLOR = 'indigo';

export function kanbanLogoClass(color: string | null | undefined): string {
  return (color && KANBAN_LOGO_CLASSES[color]) || KANBAN_LOGO_CLASSES[DEFAULT_KANBAN_COLOR];
}
