const express = require('express');
const verifyAdminToken = require('../../../middleware/jwtConfig');
const router = express.Router();
const CategoryController = require('./categoryController');

router.get('/', verifyAdminToken(['admin']), CategoryController.getAllCategories);
router.get('/:categoryId', verifyAdminToken(['admin']), CategoryController.getCategoryByCategoryId);
router.post('/', verifyAdminToken(['admin']), CategoryController.createCategory);
router.patch('/:category', verifyAdminToken(['admin']), CategoryController.updateCategoryById);
router.delete('/:category', verifyAdminToken(['admin']), CategoryController.deleteCategoryById);

module.exports = router;