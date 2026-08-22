// ============================================================================
// EEMS API - Express Application
// ============================================================================
//
// Responsibilities:
//
// 1. Security middleware
// 2. CORS
// 3. Request parsing
// 4. Request ID
// 5. HTTP logging
// 6. Swagger API documentation
// 7. Central API route registration
// 8. 404 handling
// 9. Centralized error handling
//
// ============================================================================

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";

import { env } from "@/config/env.js";
import { swaggerDocument } from "@/config/swagger.js";

import { requestId } from "@/middleware/request-id.js";
import { notFound } from "@/middleware/not-found.js";
import { errorHandler } from "@/middleware/error-handler.js";
import { apiRateLimiter } from "@/middleware/rate-limit.js";

import routes from "@/routes/index.js";

// ============================================================================
// APPLICATION
// ============================================================================

const app = express();

// ============================================================================
// EXPRESS SETTINGS
// ============================================================================

app.disable("x-powered-by");

// ============================================================================
// SECURITY
// ============================================================================

app.use(helmet());

// ============================================================================
// CORS
// ============================================================================

app.use(
  cors({
    origin: env.CORS_ORIGIN,
  }),
);

// ============================================================================
// REQUEST BODY PARSING
// ============================================================================

app.use(
  express.json({
    limit: "1mb",
  }),
);

// ============================================================================
// URL-ENCODED REQUEST BODY
// ============================================================================

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  }),
);

// ============================================================================
// REQUEST IDENTIFICATION
// ============================================================================

app.use(requestId);

// ============================================================================
// HTTP LOGGING
// ============================================================================

app.use(pinoHttp());

// ============================================================================
// SWAGGER / OPENAPI DOCUMENTATION
// ============================================================================
//
// Swagger UI:
//     GET /docs
//
// OpenAPI JSON:
//     GET /docs.json
//
// IMPORTANT:
// /docs.json MUST be registered before /docs because
// swaggerUi.serve is mounted on the /docs prefix.
// ============================================================================

// --------------------------------------------------------------------------
// OpenAPI JSON
// --------------------------------------------------------------------------

app.get("/docs.json", (_req, res) => {
  res.json(swaggerDocument);
});

// --------------------------------------------------------------------------
// Swagger UI
// --------------------------------------------------------------------------

app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customSiteTitle: "EEMS API Documentation",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      docExpansion: "list",
    },
  }),
);

// ============================================================================
// CENTRAL API ROUTER
// ============================================================================
//
// All EEMS API modules are registered inside:
//
//     src/routes/index.ts
//
// Therefore app.ts only needs one API mount:
//
//     /api
//
// ============================================================================

app.use("/api", routes);

// ============================================================================
// 404 HANDLER
// ============================================================================
//
// This MUST come after Swagger and all valid application routes.
// ============================================================================

app.use(notFound);

// ============================================================================
// GLOBAL ERROR HANDLER
// ============================================================================
//
// This MUST be the final middleware.
// ============================================================================

app.use(errorHandler);

// ============================================================================
// CENTRAL API ROUTER
// ============================================================================
//
// All EEMS API modules are registered inside:
//
//     src/routes/index.ts
//
// Therefore app.ts only needs one API mount:
//
//     /api
//
// Rate limiting is applied before the API router so that every API endpoint
// receives baseline protection.
// ============================================================================

app.use("/api", apiRateLimiter, routes);
// ============================================================================
// EXPORT
// ============================================================================

export default app;
