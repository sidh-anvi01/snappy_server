import mongoose from "mongoose";
import { Status } from "../models/statusModel.js";

const STATUS_LIFETIME_MS = 24 * 60 * 60 * 1000;
const MAX_STATUS_IMAGE_LENGTH = 4.4 * 1024 * 1024;
const STATUS_IMAGE_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export const getStatuses = async (req, res) => {
    try {
        const statuses = await Status.find({ expiresAt: { $gt: new Date() } })
            .populate("owner", "fullName profilePhoto")
            .sort({ createdAt: -1 })
            .lean();
        return res.status(200).json(statuses);
    } catch (error) {
        console.error("Could not load statuses:", error);
        return res.status(500).json({ message: "Could not load status updates." });
    }
};

export const createStatus = async (req, res) => {
    try {
        const { image } = req.body;
        if (
            typeof image !== "string" ||
            image.length > MAX_STATUS_IMAGE_LENGTH ||
            !STATUS_IMAGE_PATTERN.test(image)
        ) {
            return res.status(400).json({
                message: "Status photo must be a JPEG, PNG, or WebP image no larger than 3 MB."
            });
        }

        const status = await Status.create({
            owner: req.id,
            image,
            expiresAt: new Date(Date.now() + STATUS_LIFETIME_MS)
        });
        const result = await status.populate("owner", "fullName profilePhoto");
        return res.status(201).json(result);
    } catch (error) {
        console.error("Could not create status:", error);
        return res.status(500).json({ message: "Could not upload status update." });
    }
};

export const deleteStatus = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid status id." });
        }
        const status = await Status.findOneAndDelete({
            _id: req.params.id,
            owner: req.id
        });
        if (!status) {
            return res.status(404).json({ message: "Status update not found." });
        }
        return res.status(200).json({ message: "Status update deleted." });
    } catch (error) {
        console.error("Could not delete status:", error);
        return res.status(500).json({ message: "Could not delete status update." });
    }
};
