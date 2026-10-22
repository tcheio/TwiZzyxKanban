const db = require('../db/connection');

const DEFAULT_FROM = '0001-01-01';
const DEFAULT_TO = '9999-12-31T23:59:59.999Z';

// `to` arrive typiquement comme une simple date 'YYYY-MM-DD' (ex: <input type="date">
// côté frontend) : comparée telle quelle à un horodatage complet, elle exclurait tout
// événement survenu ce jour-là après minuit pile. On l'étend donc à la fin de journée
// pour qu'elle reste inclusive.
function normalizePeriod(from, to) {
  const normalizedTo = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59.999Z` : to;
  return { from: from || DEFAULT_FROM, to: normalizedTo || DEFAULT_TO };
}

// Temps moyen (en heures) passé par les cartes dans chaque colonne du kanban avant d'en
// sortir (cf card_column_history, alimentée par cards.controller.js::create/move). Ne
// compte que les séjours terminés (la carte a bien quitté la colonne) dont la sortie
// tombe dans la période ; un séjour en cours n'a pas de durée connue et n'est jamais
// compté. Les colonnes sans aucun séjour terminé sur la période sont absentes du résultat.
function columnDurations(kanbanId, from, to) {
  const { from: periodFrom, to: periodTo } = normalizePeriod(from, to);
  return db
    .prepare(
      `WITH ordered AS (
         SELECT
           h.column_id,
           h.entered_at,
           LEAD(h.entered_at) OVER (PARTITION BY h.card_id ORDER BY h.entered_at, h.id) AS left_at
         FROM card_column_history h
         JOIN cards c ON c.id = h.card_id
         WHERE c.kanban_id = @kanbanId
       )
       SELECT
         columns.id AS column_id,
         columns.name AS column_name,
         COUNT(*) AS sample_count,
         AVG((julianday(ordered.left_at) - julianday(ordered.entered_at)) * 24) AS avg_hours
       FROM ordered
       JOIN columns ON columns.id = ordered.column_id
       WHERE ordered.left_at IS NOT NULL
         AND ordered.left_at BETWEEN @from AND @to
       GROUP BY columns.id, columns.name
       ORDER BY columns.position`
    )
    .all({ kanbanId, from: periodFrom, to: periodTo });
}

// Stats par membre du kanban sur la période :
// - completed_count : tickets ayant atteint la colonne "✅Publié" (cards.published_at)
//   pendant la période, dont il/elle est responsable (principal ou additionnel).
// - on_time_count / with_due_date_count : parmi ceux-ci, ceux qui avaient une échéance, et
//   combien l'ont respectée (publié au plus tard le jour de l'échéance).
// - avg_lead_days : avance moyenne sur l'échéance en jours (positif = en avance, négatif
//   = en retard), parmi les tickets terminés avec échéance sur la période.
// - current_workload : tickets actuellement assignés, ni annulés ni terminés — un
//   instantané, jamais filtré par période. "Terminé" = soit déjà publié (c.published_at),
//   soit dans la dernière colonne du kanban par position (ex: "Fait" du template basique,
//   qui n'a pas de notion de publication) — cf controllers/me.controller.js::myTickets,
//   même règle.
function userStats(kanbanId, from, to) {
  const { from: periodFrom, to: periodTo } = normalizePeriod(from, to);
  return db
    .prepare(
      `SELECT
         km.user_id,
         u.username,
         COALESCE(SUM(CASE WHEN c.published_at BETWEEN @from AND @to THEN 1 ELSE 0 END), 0) AS completed_count,
         COALESCE(SUM(CASE WHEN c.published_at BETWEEN @from AND @to AND c.due_date IS NOT NULL THEN 1 ELSE 0 END), 0)
           AS with_due_date_count,
         COALESCE(
           SUM(
             CASE
               WHEN c.published_at BETWEEN @from AND @to AND c.due_date IS NOT NULL AND date(c.published_at) <= c.due_date
               THEN 1 ELSE 0
             END
           ), 0
         ) AS on_time_count,
         AVG(
           CASE
             WHEN c.published_at BETWEEN @from AND @to AND c.due_date IS NOT NULL
             THEN julianday(c.due_date) - julianday(date(c.published_at))
           END
         ) AS avg_lead_days,
         COALESCE(
           SUM(
             CASE
               WHEN c.id IS NOT NULL AND c.cancelled_at IS NULL AND c.published_at IS NULL
                 AND col.position < (SELECT MAX(position) FROM columns WHERE kanban_id = @kanbanId)
               THEN 1 ELSE 0
             END
           ), 0
         ) AS current_workload
       FROM kanban_members km
       JOIN users u ON u.id = km.user_id
       LEFT JOIN (
         SELECT assigned_user_id AS user_id, id AS card_id FROM cards WHERE kanban_id = @kanbanId AND assigned_user_id IS NOT NULL
         UNION
         SELECT ca.user_id, ca.card_id FROM card_assignees ca JOIN cards c2 ON c2.id = ca.card_id WHERE c2.kanban_id = @kanbanId
       ) involved ON involved.user_id = km.user_id
       LEFT JOIN cards c ON c.id = involved.card_id
       LEFT JOIN columns col ON col.id = c.column_id
       WHERE km.kanban_id = @kanbanId
       GROUP BY km.user_id, u.username
       ORDER BY u.username`
    )
    .all({ kanbanId, from: periodFrom, to: periodTo });
}

module.exports = { columnDurations, userStats };
