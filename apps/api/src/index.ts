import express from "express";
import { config } from "./config.js";

const app = express();
const port = config.port;

// A route: when someone visits GET /, send back a short message.
app.get("/", (_req, res) => {
  res.json({ message: "Replay API is running" });
});

// Health check: tells anyone asking that the server is alive.
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Start listening for requests on the port.
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
