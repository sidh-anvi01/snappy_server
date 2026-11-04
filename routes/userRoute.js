import express from "express";
import { getOtherUsers, login, logout, register, updateProfile } from "../controllers/userController.js";
import isAuthenticated from "../middleware/isAuthenticated.js";

const router = express.Router();

router.route("/register").post(register);
router.route("/login").post(login);
router.route("/logout").get(logout);
router.route("/update").put(isAuthenticated, updateProfile);

router.route("/").get(isAuthenticated,getOtherUsers);

export default router;