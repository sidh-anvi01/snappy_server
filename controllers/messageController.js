import { Conversation } from "../models/conversationModel.js";
import { Message } from "../models/messageModel.js";
import { getReceiverSocketId, io } from "../socket/socket.js";

export const sendMessage = async (req,res) => {
    try {
        const senderId = req.id;
        const receiverId = req.params.id;
        const { message = "", media = null } = req.body;
        const mediaType = media ? req.body.mediaType || "image" : null;

        if (!message.trim() && !media) {
            return res.status(400).json({ message: "A message or attachment is required." });
        }

        const isValidImage =
            mediaType === "image" &&
            /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(media || "");
        const isValidAudio =
            mediaType === "audio" &&
            /^data:audio\/(?:mp4|x-m4a|aac);base64,/.test(media || "");
        if (media && ((!isValidImage && !isValidAudio) || media.length > 4 * 1024 * 1024)) {
            return res.status(400).json({ message: "Attachment is invalid or exceeds the supported size." });
        }

        let gotConversation = await Conversation.findOne({
            participants:{$all : [senderId, receiverId]},
        });

        if(!gotConversation){
            gotConversation = await Conversation.create({
                participants:[senderId, receiverId]
            })
        };
        const newMessage = await Message.create({
            senderId,
            receiverId,
            message: message.trim(),
            media,
            mediaType
        });
        if(newMessage){
            gotConversation.messages.push(newMessage._id);
        };
        

        await gotConversation.save();
         
        const responseMessage = newMessage.toObject();
        if (mediaType === "audio") {
            responseMessage.media = null;
        }

        // SOCKET IO
        const receiverSocketId = getReceiverSocketId(receiverId);
        if(receiverSocketId){
            io.to(receiverSocketId).emit("newMessage", responseMessage);
        }
        return res.status(201).json({
            newMessage: responseMessage
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Failed to send message." });
    }
}
export const getMessage = async (req,res) => {
    try {
        const receiverId = req.params.id;
        const senderId = req.id;
        await Message.updateMany(
            { senderId: receiverId, receiverId: senderId, isRead: { $ne: true } },
            { $set: { isRead: true } }
        );

        const conversation = await Conversation.findOne({
            participants:{$all : [senderId, receiverId]}
        }).populate("messages"); 
        const messages = (conversation?.messages || []).map((message) => {
            const result = message.toObject();
            if (result.mediaType === "audio") {
                result.media = null;
            }
            return result;
        });
        return res.status(200).json(messages);
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Failed to load messages." });
    }
}

export const markMessagesRead = async (req, res) => {
    try {
        const result = await Message.updateMany(
            { senderId: req.params.id, receiverId: req.id, isRead: { $ne: true } },
            { $set: { isRead: true } }
        );
        return res.status(200).json({ modifiedCount: result.modifiedCount });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Failed to mark messages as read." });
    }
};

export const getAudioMessage = async (req, res) => {
    try {
        const audioMessage = await Message.findOne({
            _id: req.params.id,
            mediaType: "audio",
            $or: [{ senderId: req.id }, { receiverId: req.id }]
        }).select("media");

        const audioData = audioMessage?.media?.match(
            /^data:audio\/(mp4|x-m4a|aac);base64,(.+)$/s
        );
        if (!audioData) {
            return res.status(404).json({ message: "Audio message not found." });
        }

        const audioBuffer = Buffer.from(audioData[2], "base64");
        if (!audioBuffer.length) {
            return res.status(404).json({ message: "Audio message is empty." });
        }

        return res
            .status(200)
            .set({
                "Content-Type": `audio/${audioData[1]}`,
                "Content-Length": audioBuffer.length,
                "Cache-Control": "private, no-store"
            })
            .send(audioBuffer);
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Failed to load audio message." });
    }
};