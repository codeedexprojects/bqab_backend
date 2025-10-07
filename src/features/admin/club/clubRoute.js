const express = require('express');
const verifyAdminToken = require('../../../middleware/jwtConfig');
const router = express.Router();
const ClubController = require('./clubController');

router.get('/', verifyAdminToken(['admin']), ClubController.getAllClubs);
router.get('/:clubId', verifyAdminToken(['admin']), ClubController.getClubById);
router.post('/', verifyAdminToken(['admin']), ClubController.createClub);
router.patch('/:clubId', verifyAdminToken(['admin']), ClubController.updateClubById);
router.delete('/:clubId', verifyAdminToken(['admin']), ClubController.deleteClubById);

module.exports = router;