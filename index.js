// const express = require('express')// method-1
import express from "express"; // method-2
import dotenv from "dotenv"; 
import connectDB from "./config/database.js";
import userRoute from "./routes/userRoute.js";
import messageRoute from "./routes/messageRoute.js";
import statusRoute from "./routes/statusRoute.js";
import callRoute from "./routes/callRoute.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import { app,server } from "./socket/socket.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config({});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5000;

// middleware
app.use(express.urlencoded({extended:true}));
app.use(express.json({ limit: "4.5mb" }));
app.use(cookieParser());
const corsOption={
    origin:'*',
    credentials:true
};
app.use(cors(corsOption)); 
app.use(express.static(path.join(__dirname, "public")));


// routes
app.use("/api/v1/user",userRoute); 
app.use("/api/v1/message",messageRoute);
app.use("/api/v1/status", statusRoute);
app.use("/api/v1/call", callRoute);
 
app.get("/terms-and-policies", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "terms-and-policies.html"));
});

app.get("/", (req, res) => {
  res.send("API Running...");
});
server.listen(PORT, ()=>{
    connectDB();
    console.log(`Server listen at prot ${PORT}`);
});
