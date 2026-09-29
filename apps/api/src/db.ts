// One shared database connection for the whole API.
// Import `prisma` from here anywhere you need to read or save data.
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "./config.js";
import { PrismaClient } from "./generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: config.databaseUrl });

export const prisma = new PrismaClient({ adapter });
