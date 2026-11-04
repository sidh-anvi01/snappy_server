import mongoose from "mongoose";

const statusModel = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    image: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    }
}, { timestamps: true });

statusModel.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Status = mongoose.model("Status", statusModel);
