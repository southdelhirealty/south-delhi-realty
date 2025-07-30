// Load environment variables from .env file
import "dotenv/config";

// Production-ready imports
import compression from "compression";
import cors from "cors";
import express, { type Express } from "express";
import session from "express-session";
import helmet from "helmet";
import { createServer } from "http";
import morgan from "morgan";
import passport from "passport";
import { closeDatabase, healthCheckDatabase, initializeDB } from "./db";
import { registerRoutes } from "./routes";
import sitemapRoutes from "./sitemap";
import { storage } from "./storage";
import { createLogger } from "./utils/logger";
import { log, setupVite } from "./vite";

// Initialize logger
const logger = createLogger();

// Set a flag to identify we're using in-memory storage
(global as any).USE_IN_MEMORY_STORAGE = true;

async function startServer() {
  try {
    // Initialize database first
    await initializeDB();
    console.log("✅ Database initialized successfully");

    // Create Express instance
    const app: Express = express();

    // Create HTTP server
    const server = createServer(app);

    // Trust proxy for production deployments (nginx, cloudflare, etc.)
    app.set("trust proxy", 1);

    // Basic middleware setup
    app.use(express.json({ limit: "100mb" }));
    app.use(express.urlencoded({ extended: true, limit: "100mb" }));

    // Security middleware
    const isDevelopment = process.env.NODE_ENV === "development";

    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              "https://fonts.googleapis.com",
            ],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            mediaSrc: [
              "'self'",
              "https:",
              "data:",
              "blob:",
              "https://res.cloudinary.com",
            ],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            connectSrc: [
              "'self'",
              "https://api.cloudinary.com",
              "https://res.cloudinary.com",
              "https://overpass-api.de",
            ],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            scriptSrcAttr: ["'none'"],
            upgradeInsecureRequests: isDevelopment ? null : [],
          },
        },
        crossOriginEmbedderPolicy: false,
      })
    );

    // Set custom Permissions-Policy header to explicitly disable Privacy Sandbox features
    app.use((req: any, res: any, next: any) => {
      res.setHeader(
        "Permissions-Policy",
        [
          "browsing-topics=()",
          "join-ad-interest-group=()",
          "run-ad-auction=()",
          "attribution-reporting=()",
          "private-state-token-issuance=()",
          "private-state-token-redemption=()",
          "geolocation=(self)",
          "camera=()",
          "microphone=()",
          "display-capture=()",
        ].join(", ")
      );
      next();
    });

    // Compression middleware for production
    app.use(
      compression({
        level: 6,
        threshold: 1024,
        filter: (req: any, res: any) => {
          if (req.headers["x-no-compression"]) {
            return false;
          }
          return compression.filter(req, res);
        },
      }) as any
    );

    // Rate limiting removed - no maximum login attempts

    // HTTP request logging
    if (process.env.NODE_ENV === "production") {
      app.use(
        morgan("combined", {
          stream: {
            write: (message: string) => logger.info(message.trim()),
          },
        })
      );
    } else {
      app.use(morgan("dev"));
    }

    // CORS configuration with proper origins
    const nodeEnv = (process.env.NODE_ENV || "development").trim();

    // Use allowed origins from environment variable if available, otherwise use defaults
    const allowedOriginsFromEnv = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
      : [];

    // In production, use the allowed origins from env, otherwise be more permissive for development
    const allowedOrigins =
      nodeEnv === "production"
        ? allowedOriginsFromEnv.length > 0
          ? allowedOriginsFromEnv
          : [
              "https://south-delhi-realty-a8lwn.ondigitalocean.app",
              "https://southdelhirealty.com",
              "http://localhost:7922",
              "http://127.0.0.1:7922",
              "http://localhost:5000",
              "http://127.0.0.1:5000",
            ]
        : [
            "http://localhost:3000",
            "http://localhost:5000",
            "http://localhost:7922",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5000",
            "http://127.0.0.1:7922",
            "https://southdelhirealty.com",
            "https://south-delhi-realty-a8lwn.ondigitalocean.app",
            ...allowedOriginsFromEnv,
          ];

    console.log(`CORS allowed origins: ${JSON.stringify(allowedOrigins)}`);

    const corsOptions: cors.CorsOptions = {
      origin: (origin, callback) => {
        // Allow requests with no origin (same-origin requests, mobile apps, curl requests)
        // This is safe when the server is serving both frontend and API
        if (!origin) {
          return callback(null, true);
        }

        if (origin && allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn(
            `CORS blocked request from origin: ${origin}. Allowed origins: ${JSON.stringify(
              allowedOrigins
            )}`
          );
          callback(new Error("Not allowed by CORS"), false);
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
      ],
      exposedHeaders: ["Set-Cookie"],
    };

    // Apply CORS only to API routes to avoid issues with static assets
    app.use("/api", cors(corsOptions));

    // Session configuration with production-ready settings
    if (
      !process.env.SESSION_SECRET ||
      process.env.SESSION_SECRET === "your-secret-key-change-in-production"
    ) {
      if (process.env.NODE_ENV === "production") {
        logger.error("SESSION_SECRET must be set in production!");
        process.exit(1);
      } else {
        logger.warn("Using default SESSION_SECRET in development");
      }
    }

    // Configure session middleware with improved production settings
    const sessionConfig: session.SessionOptions = {
      secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
      resave: false, // Don't save session if unmodified
      saveUninitialized: false, // Don't create session until something stored
      store: storage.sessionStore,
      name: "southdelhi.session",
      proxy: true, // Trust the reverse proxy
      rolling: true, // Reset the cookie Max-Age on every request
      cookie: {
        secure: process.env.SESSION_SECURE_COOKIES === "true", // Use env variable
        sameSite: "lax" as const, // Use 'lax' for better compatibility
        maxAge: parseInt(process.env.SESSION_MAX_AGE || "86400000"), // Use env variable, default 24 hours
        httpOnly: true,
        domain: undefined, // Remove domain restriction for now
        path: "/", // Ensure cookie is available for all paths
      },
    };

    // Only set secure cookies if explicitly enabled or in production with SSL
    if (
      process.env.NODE_ENV === "production" &&
      process.env.SSL_ENABLED === "true"
    ) {
      sessionConfig.cookie!.secure = true;
    }

    console.log("📋 Session configuration:", {
      secure: sessionConfig.cookie?.secure,
      sameSite: sessionConfig.cookie?.sameSite,
      domain: sessionConfig.cookie?.domain,
      maxAge: sessionConfig.cookie?.maxAge,
      httpOnly: sessionConfig.cookie?.httpOnly,
      proxy: sessionConfig.proxy,
    });

    app.use(session(sessionConfig) as any);

    // Add session debugging middleware
    app.use((req: any, res: any, next: any) => {
      if (req.path.startsWith("/api/")) {
        console.log("📊 Session Debug:", {
          path: req.path,
          method: req.method,
          sessionID: req.sessionID,
          sessionExists: !!req.session,
          sessionData: req.session
            ? {
                passport: req.session.passport,
                cookie: {
                  secure: req.session.cookie.secure,
                  sameSite: req.session.cookie.sameSite,
                  maxAge: req.session.cookie.maxAge,
                  httpOnly: req.session.cookie.httpOnly,
                  domain: req.session.cookie.domain,
                  path: req.session.cookie.path,
                },
              }
            : null,
          isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
          user: req.user
            ? { id: req.user.id, username: req.user.username }
            : null,
          cookies: req.headers.cookie
            ? req.headers.cookie.substring(0, 100) + "..."
            : "missing",
          userAgent: req.headers["user-agent"] ? "present" : "missing",
          origin: req.headers.origin || "not-set",
          referer: req.headers.referer || "not-set",
          setCookieHeaders: res.getHeaders()["set-cookie"] || "none",
        });
      }
      next();
    });

    // Initialize passport and session
    app.use(passport.initialize() as any);
    app.use(passport.session() as any);

    // Health check endpoint (for DigitalOcean and general monitoring)
    app.get("/health", async (req: any, res: any) => {
      try {
        // Use the enhanced health check function
        const isHealthy = await healthCheckDatabase();
        if (isHealthy) {
          res.status(200).json({
            status: "healthy",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV,
          });
        } else {
          res.status(503).json({
            status: "unhealthy",
            error: "Database connection failed",
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        logger.error("Health check failed:", error);
        res.status(503).json({
          status: "unhealthy",
          error: "Health check exception",
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Readiness check
    app.get("/ready", async (req: any, res: any) => {
      try {
        // Use the enhanced health check function with timeout
        const isReady = await Promise.race([
          healthCheckDatabase(),
          new Promise<boolean>((resolve) => {
            setTimeout(() => resolve(false), 3000); // 3 second timeout for readiness
          }),
        ]);

        if (isReady) {
          res.status(200).json({
            status: "Ready",
            timestamp: new Date().toISOString(),
          });
        } else {
          res.status(503).json({
            status: "Not Ready",
            error: "Database not ready",
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        logger.error("Readiness check failed:", error);
        res.status(503).json({
          status: "Not Ready",
          error: "Readiness check exception",
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Metrics endpoint (basic)
    app.get("/metrics", (req: any, res: any) => {
      const metrics = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        timestamp: new Date().toISOString(),
      };
      res.json(metrics);
    });

    // Request logging middleware for API routes
    app.use((req: any, res: any, next: any) => {
      const start = Date.now();
      const path = req.path;
      let capturedJsonResponse: Record<string, any> | undefined = undefined;

      const originalResJson = res.json;
      res.json = function (bodyJson: any, ...args: any[]) {
        capturedJsonResponse = bodyJson;
        return originalResJson.apply(res, [bodyJson, ...args]);
      };

      res.on("finish", () => {
        const duration = Date.now() - start;
        if (path.startsWith("/api")) {
          let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
          if (capturedJsonResponse) {
            logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
          }

          if (logLine.length > 80) {
            logLine = logLine.slice(0, 79) + "…";
          }

          log(logLine);

          // Log errors to winston
          if (res.statusCode >= 400) {
            logger.error(
              `${req.method} ${path} ${res.statusCode} - ${req.ip} - ${duration}ms`
            );
          }
        }
      });

      next();
    });

    // SEO routes (sitemap and robots.txt) - before API routes
    app.use("/", sitemapRoutes);

    // Register all application routes
    await registerRoutes(app);
    console.log("✅ Routes registered successfully");

    // Setup Vite in development or static files in production (after API routes)
    const env = (process.env.NODE_ENV || "development").trim();
    console.log(`Environment check: "${env}"`);
    if (env === "development") {
      console.log("Using Vite development server");
      await setupVite(app, server);
    } else {
      console.log("Using static file serving");
      const { serveStatic } = await import("./vite");
      serveStatic(app);
    }

    // 404 handler for API routes
    app.use("/api/*", (req: any, res: any) => {
      res.status(404).json({ message: "API endpoint not found" });
    });

    // Global error handler (must be last)
    app.use((err: any, req: any, res: any, next: any) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Improved error logging
      logger.error("Unhandled error:", {
        error: {
          message: err.message,
          stack: err.stack,
          name: err.name,
          ...err,
        },
        request: {
          method: req.method,
          url: req.url,
          headers: req.headers,
          ip: req.ip,
        },
      });

      // Don't expose internal errors in production
      const responseMessage =
        process.env.NODE_ENV === "production" && status === 500
          ? "Internal Server Error"
          : message;

      res.status(status).json({
        message: responseMessage,
        ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
      });
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      // Close database connections first
      try {
        await closeDatabase();
        logger.info("Database connections closed successfully");
      } catch (error) {
        logger.error("Error closing database connections:", error);
      }

      server.close(() => {
        logger.info("HTTP server closed.");
        logger.info("Application shutdown complete.");
        process.exit(0);
      });

      // Force close server after 30s
      setTimeout(() => {
        logger.error(
          "Could not close connections in time, forcefully shutting down"
        );
        process.exit(1);
      }, 30000);
    };

    // Listen for shutdown signals
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle uncaught exceptions
    process.on("uncaughtException", (err) => {
      logger.error("Uncaught Exception:", err);
      process.exit(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled Rejection at:", promise, "reason:", reason);
      process.exit(1);
    });

    // Initialize superadmin user in production
    if (process.env.NODE_ENV === "production") {
      try {
        const { initializeSuperAdmin } = await import("./init-superadmin");
        await initializeSuperAdmin();
      } catch (error) {
        logger.warn(
          "Superadmin initialization failed:",
          error instanceof Error ? error.message : String(error)
        );
        // Don't exit, just log the warning
      }
    }

    const port = parseInt(process.env.PORT || "5000", 10);
    server.listen(port, "0.0.0.0", () => {
      logger.info(`🚀 South Delhi Real Estate server starting...`);
      logger.info(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
      logger.info(`🌐 Server running on port ${port}`);
      logger.info(`📊 Health check: http://localhost:${port}/health`);
      if (process.env.NODE_ENV === "production") {
        logger.info(
          `👤 Default superadmin credentials: superadmin / superadmin123`
        );
      }
      log(`serving on port ${port}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
