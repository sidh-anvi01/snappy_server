import mongoose from "mongoose";

const messageModel = new mongoose.Schema({
    senderId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    receiverId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    message:{
        type:String,
        default:""
    },
    media:{
        type:String,
        default:null
    },
    mediaType:{
        type:String,
        enum:["image", "audio"],
        default:null
    },
    isRead:{
        type:Boolean,
        default:false
    }
},{timestamps:true});

messageModel.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageModel.index({ receiverId: 1, isRead: 1 });

export const Message = mongoose.model("Message", messageModel);