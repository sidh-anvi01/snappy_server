import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, test } from "node:test";
import { getIceServers } from "../controllers/callController.js";

const originalTurnUrls = process.env.TURN_URLS;
const originalTurnSecret = process.env.TURN_SECRET;

afterEach(() => {
  if (originalTurnUrls === undefined) {
    delete process.env.TURN_URLS;
  } else {
    process.env.TURN_URLS = originalTurnUrls;
  }
  if (originalTurnSecret === undefined) {
    delete process.env.TURN_SECRET;
  } else {
    process.env.TURN_SECRET = originalTurnSecret;
  }
});

const createResponse = () => ({
  headers: {},
  statusCode: 200,
  body: null,
  set(name, value) {
    this.headers[name] = value;
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("returns STUN servers when TURN is not configured", () => {
  delete process.env.TURN_URLS;
  delete process.env.TURN_SECRET;
  const response = createResponse();

  getIceServers({ id: "user-1" }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Cache-Control"], "private, no-store");
  assert.deepEqual(response.body.iceServers, [
    { urls: "stun:stun.l.google.com:19302" },
  ]);
});

test("returns temporary coturn credentials when TURN is configured", () => {
  const secret = "test-shared-secret";
  process.env.TURN_URLS =
    "turn:turn.example.com:3478?transport=udp, turn:turn.example.com:3478?transport=tcp";
  process.env.TURN_SECRET = secret;
  const response = createResponse();
  const nowSeconds = Math.floor(Date.now() / 1000);

  getIceServers({ id: "user-1" }, response);

  const [stunServer, turnServer] = response.body.iceServers;
  assert.equal(response.statusCode, 200);
  assert.deepEqual(stunServer, { urls: "stun:stun.l.google.com:19302" });
  assert.deepEqual(turnServer.urls, [
    "turn:turn.example.com:3478?transport=udp",
    "turn:turn.example.com:3478?transport=tcp",
  ]);
  const [expiresAt, userId] = turnServer.username.split(":");
  assert.equal(userId, "user-1");
  assert.ok(Number(expiresAt) >= nowSeconds + 3600);
  assert.ok(Number(expiresAt) <= nowSeconds + 3601);
  assert.equal(
    turnServer.credential,
    createHmac("sha1", secret)
      .update(turnServer.username)
      .digest("base64"),
  );
});

test("rejects partial TURN configuration", () => {
  process.env.TURN_URLS = "turn:turn.example.com:3478?transport=udp";
  delete process.env.TURN_SECRET;
  const response = createResponse();

  getIceServers({ id: "user-1" }, response);

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, {
    message: "Video calling is not configured for all networks.",
  });
});
