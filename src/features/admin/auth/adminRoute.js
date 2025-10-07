const express = require('express');
const router = express.Router();
const adminController = require('./adminController')


router.post('/register',adminController.registerAdmin)
router.post('/login', adminController.login)





module.exports=router