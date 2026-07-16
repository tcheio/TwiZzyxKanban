import { UrlMatcher, UrlSegment } from '@angular/router';

// Un segment "code-id" (ex. "TK-TWIZZYX-42") est un ticket : le code peut lui-même
// contenir des tirets, donc on ancre sur le dernier "-<chiffres>" de fin de segment.
const TICKET_SEGMENT_RE = /^(.+)-(\d+)$/;

// Fait correspondre /kanbans/:code (le tableau du kanban), ex. /kanbans/TK-TWIZZYX
export const kanbanBoardMatcher: UrlMatcher = (segments) => {
  if (segments.length !== 1) return null;
  if (TICKET_SEGMENT_RE.test(segments[0].path)) return null;
  return { consumed: segments, posParams: { kanbanCode: segments[0] } };
};

// Fait correspondre /kanbans/:code-:id (un ticket), ex. /kanbans/TK-TWIZZYX-42
export const kanbanTicketMatcher: UrlMatcher = (segments) => {
  if (segments.length !== 1) return null;
  const match = TICKET_SEGMENT_RE.exec(segments[0].path);
  if (!match) return null;
  return {
    consumed: segments,
    posParams: {
      kanbanCode: new UrlSegment(match[1], {}),
      id: new UrlSegment(match[2], {}),
    },
  };
};
