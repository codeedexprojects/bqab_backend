const express = require('express');
const router = express.Router();
const rankingController = require('./rankingController');

// Overall rankings
router.get('/overall', rankingController.getOverallRankings);

// Category-specific rankings
router.get('/category/:categoryId', rankingController.getCategoryRankings);

// Tournament-specific rankings
router.get('/tournament/:tournamentId', rankingController.getTournamentRankings);


// Both Tournament and Category rankings
router.get('/universal', rankingController.getUniversalRankings);


// User points breakdown
router.get('/user/:userId/breakdown', rankingController.getUserPointsBreakdown);

// Rankings by type (singles/doubles)
router.get('/type/:type', rankingController.getRankingsByType);

module.exports = router;