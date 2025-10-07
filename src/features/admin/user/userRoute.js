const express = require('express');
const verifyAdminToken = require('../../../middleware/jwtConfig');
const router = express.Router();
const UserController = require('./userController')
const { userIdValidator, updateUserValidator } = require('./userValidator');
const validationHandler = require('../../../middleware/validationHandler');

router.post('/', verifyAdminToken(['admin']), UserController.createUser);
router.get('/', verifyAdminToken(['admin']), UserController.getAllUsers);
router.get('/', verifyAdminToken(['admin']), UserController.getAllUsers);

router.get('/:userId', verifyAdminToken(['admin']), userIdValidator, validationHandler, UserController.getUserById);
router.patch('/:userId', verifyAdminToken(['admin']), userIdValidator, updateUserValidator, validationHandler, UserController.updateUserById);
router.delete('/:userId', verifyAdminToken(['admin']), userIdValidator, validationHandler, UserController.deleteUserById);

module.exports = router;