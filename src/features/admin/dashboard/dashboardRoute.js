const express = require('express');
const verifyAdminToken = require('../../../middleware/jwtConfig');
const router = express.Router();
const dashboardController = require('./dashboardController');


router.get(
  '/', 
  verifyAdminToken(['admin']), 
  dashboardController.getDashboardCounts
);

module.exports = router;