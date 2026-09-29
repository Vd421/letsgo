// Routes for /sessions: save a new session, and list saved sessions.
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const sessionsRouter = Router();

// The "bouncer": rules incoming data must follow before it reaches the database.
const createSessionSchema = z.object({
  url: z.url(),
  userAgent: z.string().max(500).optional(),
});

// POST /sessions → check the data, save it, reply with the saved session.
sessionsRouter.post("/", async (req, res) => {
  const result = createSessionSchema.safeParse(req.body);

  if (!result.success) {
    // 400 = "the data you sent is wrong". Tell the sender exactly which field and why.
    res.status(400).json({
      error: "Invalid session data",
      issues: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  const session = await prisma.session.create({ data: result.data });

  // 201 = "created successfully".
  res.status(201).json(session);
});

// GET /sessions → list all saved sessions.
sessionsRouter.get("/", async (_req, res) => {
  const sessions = await prisma.session.findMany();
  res.json(sessions);
});
