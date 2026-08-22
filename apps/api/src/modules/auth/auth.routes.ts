// ============================================================================
// EEMS - Authentication Routes
// ============================================================================
//
// Authentication endpoints.
//
// Base path:
//
//   /api/auth
//
// Available endpoints:
//
//   POST /api/auth/login
//
// Security:
//
//   Login is public because it creates the JWT.
//   A strict rate limiter protects the endpoint against brute-force attempts.
//
// ============================================================================

import { Router } from "express";

import { authRateLimiter } from "@/middleware/rate-limit.js";

import { loginController } from "./auth.controller.js";

// ============================================================================
// ROUTER
// ============================================================================

const router = Router();

// ============================================================================
// LOGIN
// ============================================================================
//
// POST /api/auth/login
//
// Public endpoint.
//
// No JWT is required because this endpoint creates the JWT.
//
// Rate limit:
//
//   10 requests / 15 minutes / IP
//
// ============================================================================

router.post("/login", authRateLimiter, loginController);

// ============================================================================
// EXPORT
// ============================================================================

export default router;
