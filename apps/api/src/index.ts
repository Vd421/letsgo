import express from "express";

const app = express();
const port = 4000;

// A route: when someone visits GET /, send back a short message.
app.get("/", (_req, res) => {
  res.json({ message: "Replay API is running" });
});

// Start listening for requests on the port.
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
