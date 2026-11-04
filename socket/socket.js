import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const userSocketMap = new Map();
const calls = new Map();
const activeCallByUser = new Map();
const RING_TIMEOUT_MS = 45_000;

export const getReceiverSocketId = (receiverId) => {
  const sockets = userSocketMap.get(String(receiverId));
  return sockets ? Array.from(sockets) : null;
};

const clearCall = (call) => {
  clearTimeout(call.timeout);
  calls.delete(call.id);
  activeCallByUser.delete(call.callerId);
  activeCallByUser.delete(call.receiverId);
};

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token || !process.env.JWT_SECRET_KEY) {
      return next(new Error("Authentication required."));
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);
    if (!payload?.userId) {
      return next(new Error("Invalid authentication token."));
    }
    socket.data.userId = String(payload.userId);
    return next();
  } catch {
    return next(new Error("Invalid authentication token."));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId;
  socket.join(userId);

  if (!userSocketMap.has(userId)) {
    userSocketMap.set(userId, new Set());
  }
  userSocketMap.get(userId).add(socket.id);
  io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));

  socket.on("callUser", (payload = {}, acknowledge) => {
    const reply = typeof acknowledge === "function" ? acknowledge : () => {};
    const targetId = String(payload?.receiverId || "");
    const signal = payload?.signal;
    if (
      !targetId ||
      targetId === userId ||
      !signal?.sdp ||
      signal.type !== "offer"
    ) {
      reply({ ok: false, reason: "invalid_call" });
      return;
    }
    if (!userSocketMap.has(targetId)) {
      reply({ ok: false, reason: "unavailable" });
      return;
    }
    if (activeCallByUser.has(userId) || activeCallByUser.has(targetId)) {
      reply({ ok: false, reason: "busy" });
      return;
    }

    const call = {
      id: randomUUID(),
      callerId: userId,
      receiverId: targetId,
      status: "ringing",
      timeout: null,
    };
    call.timeout = setTimeout(() => {
      if (calls.get(call.id) !== call) return;
      io.to(call.callerId).emit("callTimedOut", { callId: call.id });
      io.to(call.receiverId).emit("incomingCallCancelled", { callId: call.id });
      clearCall(call);
    }, RING_TIMEOUT_MS);
    calls.set(call.id, call);
    activeCallByUser.set(call.callerId, call.id);
    activeCallByUser.set(call.receiverId, call.id);
    io.to(targetId).emit("incomingCall", {
      callId: call.id,
      callerId: userId,
      signal,
    });
    reply({ ok: true, callId: call.id });
  });

  socket.on("answerCall", (payload = {}) => {
    const callId = payload?.callId;
    const signal = payload?.signal;
    const call = calls.get(callId);
    if (
      !call ||
      call.receiverId !== userId ||
      call.status !== "ringing" ||
      !signal?.sdp ||
      signal.type !== "answer"
    ) {
      return;
    }
    clearTimeout(call.timeout);
    call.timeout = null;
    call.status = "connected";
    io.to(call.callerId).emit("callAnswered", { callId, signal });
    io.to(call.receiverId).emit("callAccepted", { callId });
  });

  socket.on("rejectCall", (payload = {}) => {
    const callId = payload?.callId;
    const call = calls.get(callId);
    if (!call || call.receiverId !== userId || call.status !== "ringing")
      return;
    io.to(call.callerId).emit("callRejected", { callId });
    io.to(call.receiverId).emit("incomingCallCancelled", { callId });
    clearCall(call);
  });

  socket.on("endCall", (payload = {}) => {
    const callId = payload?.callId;
    const call = calls.get(callId);
    if (!call || (call.callerId !== userId && call.receiverId !== userId))
      return;
    const otherUserId =
      call.callerId === userId ? call.receiverId : call.callerId;
    io.to(otherUserId).emit("callEnded", { callId });
    clearCall(call);
  });

  socket.on("disconnect", () => {
    const userSockets = userSocketMap.get(userId);
    userSockets?.delete(socket.id);
    if (userSockets?.size === 0) {
      userSocketMap.delete(userId);
      const callId = activeCallByUser.get(userId);
      const call = calls.get(callId);
      if (call) {
        const otherUserId =
          call.callerId === userId ? call.receiverId : call.callerId;
        io.to(otherUserId).emit("callEnded", { callId });
        clearCall(call);
      }
    }
    io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
  });
});

export { app, io, server };
