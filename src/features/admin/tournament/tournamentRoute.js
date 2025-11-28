const express = require('express');
const verifyAdminToken = require('../../../middleware/jwtConfig');
const router = express.Router();
const tournamentController = require('./tournamentController');
const uploadExcel = require('../../../middleware/multerExcelConfig');


router.get(
  '/', 
  verifyAdminToken(['admin']), 
  tournamentController.getAllTournaments
);

router.get(
  '/:tournamentId', 
  verifyAdminToken(['admin']), 
  tournamentController.getTournamentById
);

router.post(
  '/upload',
  verifyAdminToken(['admin']),
  uploadExcel.single('file'),
  tournamentController.createTournamentFromExcel
);



router.delete(
  '/:tournamentId', 
  verifyAdminToken(['admin']), 
  tournamentController.deleteTournament
);

module.exports = router;