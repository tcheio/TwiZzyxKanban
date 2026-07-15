const express = require('express');
const requireKanbanModerator = require('../middleware/requireKanbanModerator');
const { list, create, update, remove, reorder } = require('../controllers/columns.controller');

const router = express.Router({ mergeParams: true });

// Consultation : accessible à tout membre du kanban (affichage du tableau)
router.get('/', list);

// Gestion des colonnes (créer/renommer/supprimer/réordonner) : réservée aux modérateurs du kanban (et aux admins)
router.post('/', requireKanbanModerator, create);
router.patch('/reorder', requireKanbanModerator, reorder);
router.patch('/:id', requireKanbanModerator, update);
router.delete('/:id', requireKanbanModerator, remove);

module.exports = router;
