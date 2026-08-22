// ============================================================================
// EEMS API - Rate Limiting
// ============================================================================
//
// Responsibilities:
//
// 1. Protect authentication endpoints from brute-force attacks.
// 2. Protect the API from excessive request rates.
// 3. Provide stricter limits for login attempts.
// 4. Avoid applying an unnecessarily aggressive limit to normal API usage.
//
// ============================================================================

import rateLimit from "express-rate-limit";

// ============================================================================
// GENERAL API RATE LIMIT
// ============================================================================
//
// Applied to:
//
//   /api
//
// Limit:
//
//   300 requests / 15 minutes / IP
//
// This is intentionally moderate for a business application.
//
// ============================================================================

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 300,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  message: {
    success: false,

    error: {
      code: "RATE_LIMIT_EXCEEDED",

      message: "Too many requests. Please try again later.",
    },
  },

  handler: (_req, res) => {
    res.status(429).json({
      success: false,

      error: {
        code: "RATE_LIMIT_EXCEEDED",

        message: "Too many requests. Please try again later.",
      },
    });
  },
});

// ============================================================================
// AUTHENTICATION RATE LIMIT
// ============================================================================
//
// Authentication endpoints require a stricter limit because login attempts
// are a common brute-force attack target.
//
// Limit:
//
//   10 requests / 15 minutes / IP
//
// IMPORTANT:
//
// This limiter should be mounted specifically on the authentication router,
// not globally, so normal authenticated API usage is not unnecessarily
// restricted.
// ============================================================================

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 10,

  standardHeaders: "draft-8",

  legacyHeaders: false,

  skipSuccessfulRequests: false,

  message: {
    success: false,

    error: {
      code: "AUTH_RATE_LIMIT_EXCEEDED",

      message: "Too many authentication attempts. Please try again later.",
    },
  },

  handler: (_req, res) => {
    res.status(429).json({
      success: false,

      error: {
        code: "AUTH_RATE_LIMIT_EXCEEDED",

        message: "Too many authentication attempts. Please try again later.",
      },
    });
  },
});
