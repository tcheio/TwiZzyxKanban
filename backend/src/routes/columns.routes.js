const express = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const { list, create, update, remove, reorder } = require('../controllers/columns.controller');

const router = express.Router();

// Consultation : accessible à tout utilisateur authentifié (affichage du tableau)
router.get('/', list);

// Gestion des colonnes (créer/renommer/supprimer/réordonner) : réservée aux admins
router.post('/', requireAdmin, create);
router.patch('/reorder', requireAdmin, reorder);
router.patch('/:id', requireAdmin, update);
router.delete('/:id', requireAdmin, remove);

module.exports = router;
