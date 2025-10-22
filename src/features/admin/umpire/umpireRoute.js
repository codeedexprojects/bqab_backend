const express = require('express');
const router = express.Router();
const umpireController = require('./umpireController');

// Get all umpires with filtering
router.get('/', umpireController.getAllUmpires);

// Get umpire by ID
router.get('/:id', umpireController.getUmpireById);

// Create new umpire
router.post('/', umpireController.createUmpire);

// Update umpire
router.put('/:id', umpireController.updateUmpire);

// Delete umpire
router.delete('/:id', umpireController.deleteUmpire);

// Assign umpire to tournament
router.post('/:umpireId/assign-tournament', umpireController.assignToTournament);

// Remove umpire from tournament
router.delete('/:umpireId/tournament/:tournamentId', umpireController.removeFromTournament);

// Get umpires by tournament
router.get('/tournament/:tournamentId', umpireController.getUmpiresByTournament);

module.exports = router;