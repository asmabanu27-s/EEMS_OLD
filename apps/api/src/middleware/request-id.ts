import type { RequestHandler } from "express";
import { randomUUID } from "node:crypto";

export const requestId: RequestHandler = (req, res, next) => {
  const existingId = req.header("x-request-id");

  const id = existingId ?? randomUUID();

  res.setHeader("x-request-id", id);

  next();
};
