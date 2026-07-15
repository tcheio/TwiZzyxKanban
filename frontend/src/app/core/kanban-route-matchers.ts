import { UrlMatcher, UrlSegment } from '@angular/router';

// Fait correspondre /kanbans/:kanbanId (le tableau du kanban), ex. /kanbans/5
export const kanbanBoardMatcher: UrlMatcher = (segments) => {
  if (segments.length === 1 && /^\d+$/.test(segments[0].path)) {
    return { consumed: segments, posParams: { kanbanId: segments[0] } };
  }
  return null;
};

// Fait correspondre /kanbans/:kanbanId-:id (un ticket), ex. /kanbans/5-42
export const kanbanTicketMatcher: UrlMatcher = (segments) => {
  if (segments.length !== 1) return null;
  const match = /^(\d+)-(\d+)$/.exec(segments[0].path);
  if (!match) return null;
  return {
    consumed: segments,
    posParams: {
      kanbanId: new UrlSegment(match[1], {}),
      id: new UrlSegment(match[2], {}),
    },
  };
};
