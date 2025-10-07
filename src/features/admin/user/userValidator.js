const { body, param } = require('express-validator');

exports.userIdValidator = [
  param('userId')
    .notEmpty().withMessage('User ID is required')
    .isMongoId().withMessage('Invalid User ID format')
];

exports.updateUserValidator = [
  param('userId').isMongoId().withMessage('Invalid User ID format'),
    
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),
  
  body('role')
    .optional()
    .isIn(['customer', 'admin', 'manager']).withMessage('Invalid role')
];