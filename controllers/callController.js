import { createHmac } from "node:crypto";

const TURN_CREDENTIAL_LIFETIME_SECONDS = 60 * 60;
const STUN_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export const getIceServers = (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const urls = (process.env.TURN_URLS || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  const secret = process.env.TURN_SECRET;

  if (!urls.length && !secret) {
    return res.status(200).json({ iceServers: STUN_SERVERS });
  }
  if (!urls.length || !secret) {
    console.error("TURN_URLS and TURN_SECRET must both be configured.");
    return res
      .status(503)
      .json({ message: "Video calling is not configured for all networks." });
  }

  const username = `${Math.floor(Date.now() / 1000) + TURN_CREDENTIAL_LIFETIME_SECONDS}:${req.id}`;
  const credential = createHmac("sha1", secret)
    .update(username)
    .digest("base64");
  return res.status(200).json({
    iceServers: [
      ...STUN_SERVERS,
      {
        urls,
        username,
        credential,
      },
    ],
  });
};
