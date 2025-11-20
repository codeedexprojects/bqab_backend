const { body, param } = require('express-validator');

exports.userIdValidator = [
  param('userId')
    .notEmpty().withMessage('User ID is required')
    .isMongoId().withMessage('Invalid User ID format')
];

exports.createUserValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),
  
  body('email')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('mobile')
    .optional()
    .isMobilePhone().withMessage('Invalid mobile number'),
  
  body('role')
    .optional()
    .isIn(['customer', 'admin', 'manager']).withMessage('Invalid role')
];

exports.updateUserValidator = [
  param('userId').isMongoId().withMessage('Invalid User ID format'),
    
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),
  
  body('email')
    .optional()
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('mobile')
    .optional()
    .isMobilePhone().withMessage('Invalid mobile number'),
  
  body('role')
    .optional()
    .isIn(['customer', 'admin', 'manager']).withMessage('Invalid role')
];