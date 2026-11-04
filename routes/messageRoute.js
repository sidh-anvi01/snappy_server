import express from "express";
import {
    getAudioMessage,
    getMessage,
    markMessagesRead,
    sendMessage
} from "../controllers/messageController.js";
import isAuthenticated from "../middleware/isAuthenticated.js";

const router = express.Router();

router.route("/send/:id").post(isAuthenticated,sendMessage);
router.route("/audio/:id").get(isAuthenticated, getAudioMessage);
router.route("/:id/read").patch(isAuthenticated, markMessagesRead);
router.route("/:id").get(isAuthenticated, getMessage);

export default router;