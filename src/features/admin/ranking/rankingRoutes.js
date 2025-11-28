const express = require('express');
const router = express.Router();
const rankingController = require('./rankingController');

router.get('/overall', rankingController.getOverallRankings);

router.get('/category/:categoryId', rankingController.getCategoryRankings);

router.get('/tournament/:tournamentId', rankingController.getTournamentRankings);

router.get('/universal', rankingController.getUniversalRankings);

module.exports = router;