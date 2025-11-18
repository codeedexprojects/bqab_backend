const express = require('express');
const verifyAdminToken = require('../../../middleware/jwtConfig');
const router = express.Router();
const ClubController = require('./clubController');
const cloudinaryMapper = require('../../../middleware/cloudinaryMapper');

router.get('/', verifyAdminToken(['admin']), ClubController.getAllClubs);
router.get('/:clubId', verifyAdminToken(['admin']), ClubController.getClubById);
router.post('/', verifyAdminToken(['admin']),cloudinaryMapper, ClubController.createClub);
router.patch('/:clubId', verifyAdminToken(['admin']),cloudinaryMapper, ClubController.updateClubById);
router.delete('/:clubId', verifyAdminToken(['admin']), ClubController.deleteClubById);

module.exports = router;