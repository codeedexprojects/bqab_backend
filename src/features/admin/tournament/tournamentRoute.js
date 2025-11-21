const express = require('express');
const verifyAdminToken = require('../../../middleware/jwtConfig');
const router = express.Router();
const tournamentController = require('./tournamentController');
const multerConfig = require('../../../middleware/multerConfig');

// Tournament routes with admin verification
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
  multerConfig.single('file'),
  tournamentController.createTournamentFromExcel
);


router.delete(
  '/:tournamentId', 
  verifyAdminToken(['admin']), 
  tournamentController.deleteTournament
);


router.put(
  '/:tournamentId', 
  verifyAdminToken(['admin']), 
  tournamentController.updateTournament
);

module.exports = router;