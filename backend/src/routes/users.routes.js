const express = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const { list, liteList, create, update, remove } = require('../controllers/users.controller');

const router = express.Router();

// Accessible à tout utilisateur authentifié (pour le menu "assigné à" des cartes)
router.get('/lite', liteList);

// Gestion des comptes : réservée aux admins
router.get('/', requireAdmin, list);
router.post('/', requireAdmin, create);
router.patch('/:id', requireAdmin, update);
router.delete('/:id', requireAdmin, remove);

module.exports = router;
