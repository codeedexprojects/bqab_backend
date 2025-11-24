const express = require("express");
const verifyAdminToken = require("../../../middleware/jwtConfig");
const router = express.Router();
const UserController = require("./userController");
const { 
  userIdValidator, 
  updateUserValidator, 
  createUserValidator 
} = require("./userValidator");
const validationHandler = require("../../../middleware/validationHandler");
const cloudinaryMapper = require("../../../middleware/cloudinaryMapper");
const upload = require("../../../middleware/multerConfig");

router.post(
  "/create",
  verifyAdminToken(["admin"]),
  upload.single("image"),
  createUserValidator, 
  validationHandler,
  cloudinaryMapper,
  UserController.createUser
);

router.patch(
  "/:userId",
  verifyAdminToken(["admin"]),
  userIdValidator,
  updateUserValidator,
  validationHandler,
  upload.single("image"),
  cloudinaryMapper,
  UserController.updateUserById
);

router.get("/", verifyAdminToken(["admin"]), UserController.getAllUsers);
router.get(
  "/:userId",
  verifyAdminToken(["admin"]),
  userIdValidator,
  validationHandler,
  UserController.getUserById
);
router.delete(
  "/:userId",
  verifyAdminToken(["admin"]),
  userIdValidator,
  validationHandler,
  UserController.deleteUserById
);

module.exports = router;