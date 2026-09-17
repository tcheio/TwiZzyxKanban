const express = require('express');
const { listAssignees, removeAssignee, upsertAssignment } = require('../controllers/cardAssignees.controller');

const router = express.Router({ mergeParams: true });

router.get('/', listAssignees);
router.post('/', upsertAssignment);
router.delete('/:userId', removeAssignee);

module.exports = router;
