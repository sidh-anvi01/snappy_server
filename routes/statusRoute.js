import express from "express";
import { createStatus, deleteStatus, getStatuses } from "../controllers/statusController.js";
import isAuthenticated from "../middleware/isAuthenticated.js";

const router = express.Router();

router.route("/").get(isAuthenticated, getStatuses).post(isAuthenticated, createStatus);
router.route("/:id").delete(isAuthenticated, deleteStatus);

export default router;
