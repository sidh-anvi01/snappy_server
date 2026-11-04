import express from "express";
import { getIceServers } from "../controllers/callController.js";
import isAuthenticated from "../middleware/isAuthenticated.js";

const router = express.Router();

router.route("/ice-servers").get(isAuthenticated, getIceServers);

export default router;
