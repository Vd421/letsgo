import express from "express";
import { config } from "./config.js";
import { sessionsRouter } from "./routes/sessions.js";

const app = express();
const port = config.port;

// Let routes read JSON sent in request bodies (req.body).
app.use(express.json());

// A route: when someone visits GET /, send back a short message.
app.get("/", (_req, res) => {
  res.json({ message: "Replay API is running" });
});

// Health check: tells anyone asking that the server is alive.
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Every address starting with /sessions is handled by the sessions router.
app.use("/sessions", sessionsRouter);

// Start listening for requests on the port.
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
