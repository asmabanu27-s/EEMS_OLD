// ============================================================================
// EEMS - Environment Configuration
// ============================================================================
//
// Responsibilities:
//
// 1. Load environment variables.
// 2. Validate environment variables at application startup.
// 3. Provide typed configuration to the application.
// 4. Prevent unsafe production defaults.
//
// IMPORTANT:
//
// Never store real production secrets in source code.
// Production values must be supplied through the deployment environment or
// a proper secret-management mechanism.
//
// ============================================================================

import "dotenv/config";

import { z } from "zod";

// ============================================================================
// ENVIRONMENT SCHEMA
// ============================================================================

const envSchema = z
  .object({
    // ------------------------------------------------------------------------
    // APPLICATION
    // ------------------------------------------------------------------------

    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    PORT: z.coerce.number().int().positive().default(4000),

    // ------------------------------------------------------------------------
    // CORS
    // ------------------------------------------------------------------------
    //
    // Development:
    //
    //   http://localhost:5173
    //
    // Production:
    //
    //   Must be explicitly configured.
    //
    // Multiple origins can be supplied as a comma-separated list if required.
    //
    // ------------------------------------------------------------------------

    CORS_ORIGIN: z.string().trim().min(1).default("http://localhost:5173"),

    // ------------------------------------------------------------------------
    // DATABASE
    // ------------------------------------------------------------------------

    DATABASE_URL: z.string().trim().min(1, "DATABASE_URL is required"),

    // ------------------------------------------------------------------------
    // JWT
    // ------------------------------------------------------------------------
    //
    // JWT_SECRET must never use a development/default value in production.
    //
    // ------------------------------------------------------------------------

    JWT_SECRET: z
      .string()
      .min(32, "JWT_SECRET must contain at least 32 characters"),

    JWT_EXPIRES_IN: z.string().trim().min(1).default("8h"),

    // ------------------------------------------------------------------------
    // DOCUMENT STORAGE
    // ------------------------------------------------------------------------

    DOCUMENT_STORAGE_PATH: z
      .string()
      .trim()
      .min(1)
      .default("./storage/documents"),
  })
  .superRefine((config, ctx) => {
    // ========================================================================
    // PRODUCTION SAFETY CHECKS
    // ========================================================================

    if (config.NODE_ENV === "production") {
      // ----------------------------------------------------------------------
      // JWT SECRET
      // ----------------------------------------------------------------------

      if (
        config.JWT_SECRET ===
        "EEMS-development-secret-change-this-before-production"
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_SECRET"],
          message: "JWT_SECRET must be changed before running in production",
        });
      }

      if (config.JWT_SECRET.toLowerCase().includes("replace-with")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_SECRET"],
          message: "JWT_SECRET contains a placeholder value",
        });
      }

      // ----------------------------------------------------------------------
      // CORS
      // ----------------------------------------------------------------------
      //
      // Do not silently use localhost in production.
      // ----------------------------------------------------------------------

      if (config.CORS_ORIGIN === "http://localhost:5173") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["CORS_ORIGIN"],
          message: "CORS_ORIGIN must be explicitly configured for production",
        });
      }
    }
  });

// ============================================================================
// PARSE ENVIRONMENT
// ============================================================================
//
// Application startup fails immediately if configuration is invalid.
//
// This is intentional. A production application should not start with an
// invalid database URL, weak JWT secret, or unsafe CORS configuration.
// ============================================================================

export const env = envSchema.parse(process.env);

// ============================================================================
// ENVIRONMENT HELPERS
// ============================================================================

export const isDevelopment = env.NODE_ENV === "development";

export const isTest = env.NODE_ENV === "test";

export const isProduction = env.NODE_ENV === "production";
