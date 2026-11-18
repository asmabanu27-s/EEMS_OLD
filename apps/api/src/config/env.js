import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(4000),

  CORS_ORIGIN: z.string().default("http://localhost:5173", "https://rfhwww0d-5173.inc1.devtunnels.ms"),
});

export const env = envSchema.parse(process.env);
