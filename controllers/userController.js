import { User } from "../models/userModel.js";
import mongoose from "mongoose";
import { Message } from "../models/messageModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

                        

export const register = async (req, res) => {
    try {
        const { fullName, email, username, password, confirmPassword, gender } = req.body;
        if (!fullName || !email || !username || !password || !confirmPassword || !gender) {
            return res.status(400).json({ message: "All fields are required" });
        }
        const normalizedEmail = email.trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
            return res.status(400).json({ message: "Enter a valid email address" });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ message: "Password do not match" });
        }

        const existingEmail = await User.findOne({ email: normalizedEmail });
        if (existingEmail) {
            return res.status(400).json({ message: "Email already registered" });
        }
        const user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ message: "Username already exit try different" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        // profilePhoto
        const maleProfilePhoto = `https://avatar.iran.liara.run/public/boy?username=${username}`;
        const femaleProfilePhoto = `https://avatar.iran.liara.run/public/girl?username=${username}`;

        await User.create({
            fullName,
            email: normalizedEmail,
            username,
            password: hashedPassword,
            profilePhoto: gender === "male" ? maleProfilePhoto : femaleProfilePhoto,
            gender
        });
        return res.status(201).json({
            message: "Account created successfully.",
            success: true
        })
    } catch (error) {
        console.log(error);
        if (error.code === 11000) {
            const duplicateField = Object.keys(error.keyPattern || {})[0];
            return res.status(409).json({
                message: duplicateField === "email" ? "Email already registered" : "Username already exists"
            });
        }
        return res.status(500).json({ message: "Account creation failed" });
    }
};



export const login = async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const loginId = (email || username || "").trim();
        if (!loginId || !password) {
            return res.status(400).json({ message: "All fields are required" });
        };
        const user = await User.findOne({
            $or: [
                { email: loginId.toLowerCase() },
                { username: loginId }
            ]
        });
        if (!user) {
            return res.status(400).json({
                message: "Incorrect username or password",
                success: false
            })
        };
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(400).json({
                message: "Incorrect username or password",
                success: false
            })
        };
        const tokenData = {
            userId: user._id
        };

        const token = await jwt.sign(tokenData, process.env.JWT_SECRET_KEY, { expiresIn: '1d' });

        return res.status(200).cookie("token", token, { maxAge: 1 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'strict' }).json({
            _id: user._id,
            username: user.username,
            fullName: user.fullName,
            profilePhoto: user.profilePhoto,
            token
        });

    } catch (error) {
        console.log(error);
    }
}
export const logout = (req, res) => {
    try {
        return res.status(200).cookie("token", "", { maxAge: 0 }).json({
            message: "logged out successfully."
        })
    } catch (error) {
        console.log(error);
    }
}

export const updateProfile = async (req, res) => {
    try {
        const { fullName, about, profilePhoto } = req.body;
        const updates = {};

        if (fullName !== undefined) {
            if (typeof fullName !== "string" || !fullName.trim() || fullName.trim().length > 80) {
                return res.status(400).json({ message: "Name must be between 1 and 80 characters." });
            }
            updates.fullName = fullName.trim();
        }

        if (about !== undefined) {
            if (typeof about !== "string" || about.length > 139) {
                return res.status(400).json({ message: "About must be 139 characters or fewer." });
            }
            updates.about = about.trim();
        }

        if (profilePhoto !== undefined) {
            const isSupportedImage =
                typeof profilePhoto === "string" &&
                /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(profilePhoto) &&
                profilePhoto.length <= 2.8 * 1024 * 1024;
            const isHttpUrl =
                typeof profilePhoto === "string" &&
                /^https?:\/\/\S+$/i.test(profilePhoto) &&
                profilePhoto.length <= 2048;
            if (!isSupportedImage && !isHttpUrl) {
                return res.status(400).json({
                    message: "Choose a JPEG, PNG, or WebP profile photo no larger than 2 MB."
                });
            }
            updates.profilePhoto = profilePhoto;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "There are no profile changes to save." });
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.id,
            { $set: updates },
            { new: true, runValidators: true }
        ).select("-password -phone");

        if (!updatedUser) {
            return res.status(404).json({ message: "User account not found." });
        }

        return res.status(200).json({ updatedUser });
    } catch (error) {
        console.error("Could not update profile:", error);
        return res.status(500).json({ message: "Could not update profile." });
    }
};

export const getOtherUsers = async (req, res) => {
    try {
        const loggedInUserId = new mongoose.Types.ObjectId(req.id);
        const [otherUsers, summaries] = await Promise.all([
            User.find({ _id: { $ne: loggedInUserId } })
                .select("-password -phone")
                .lean(),
            Message.aggregate([
                {
                    $match: {
                        $or: [
                            { senderId: loggedInUserId },
                            { receiverId: loggedInUserId }
                        ]
                    }
                },
                {
                    $addFields: {
                        chatUserId: {
                            $cond: [
                                { $eq: ["$senderId", loggedInUserId] },
                                "$receiverId",
                                "$senderId"
                            ]
                        }
                    }
                },
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: "$chatUserId",
                        lastMessage: {
                            $first: {
                                message: "$message",
                                media: {
                                    $cond: [
                                        { $eq: ["$mediaType", "audio"] },
                                        null,
                                        "$media"
                                    ]
                                },
                                mediaType: "$mediaType",
                                createdAt: "$createdAt",
                                senderId: "$senderId",
                                receiverId: "$receiverId"
                            }
                        },
                        unreadCount: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ["$receiverId", loggedInUserId] },
                                            { $ne: ["$isRead", true] }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ])
        ]);

        const summariesByUserId = new Map(
            summaries.map((summary) => [String(summary._id), summary])
        );
        const usersWithChatSummaries = otherUsers.map((user) => {
            const summary = summariesByUserId.get(String(user._id));
            return {
                ...user,
                lastMessage: summary?.lastMessage || null,
                unreadCount: summary?.unreadCount || 0
            };
        });

        usersWithChatSummaries.sort((first, second) => {
            const firstDate = first.lastMessage?.createdAt
                ? new Date(first.lastMessage.createdAt).getTime()
                : 0;
            const secondDate = second.lastMessage?.createdAt
                ? new Date(second.lastMessage.createdAt).getTime()
                : 0;
            return secondDate - firstDate || first.fullName.localeCompare(second.fullName);
        });

        return res.status(200).json(usersWithChatSummaries);
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Could not load users." });
    }
}
