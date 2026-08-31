import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { checkDatabaseConnection } from "./database/pool.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";
import { authorize } from "./middlewares/authorize.js";
import { authenticate } from "./middlewares/authenticate.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { adminEventsRouter } from "./modules/events/admin-events.routes.js";
import { adminTicketTypesRouter } from "./modules/ticket-types/admin-ticket-types.routes.js";
import { adminUploadsRouter } from "./modules/uploads/admin-uploads.routes.js";
import { router } from "./routes/index.js";

export const app = express();

if (env.NODE_ENV === "production") app.set("trust proxy", 1);

app.use(helmet());

app.use(
    cors({
        origin: env.CLIENT_URL,
        credentials: true,
    }),
);

app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", async (_req, res, next) => {
    try {
        const database = await checkDatabaseConnection();

        res.status(200).json({
            success: true,
            message: "TicketBoxQR API is running",
            data: {
                database: "connected",
                databaseName: database.databaseName,
                databaseVersion: database.databaseVersion,
            },
        });
    } catch (error: unknown) {
        next(error);
    }
});

app.use("/api/auth", authRouter);
app.use("/api/admin/events", adminEventsRouter);
app.use("/api/admin/ticket-types", adminTicketTypesRouter);
app.use("/api/admin/uploads", adminUploadsRouter);

// Route dùng để kiểm tra RBAC Admin
app.get(
    "/api/admin/test",
    authenticate,
    authorize("admin"),
    (req, res) => {
        res.status(200).json({
            success: true,
            message: "Bạn có quyền Admin",
            data: {
                user: req.authUser,
            },
        });
    },
);

// Các module còn lại (events, ...) mount qua router tổng
app.use("/api", router);

app.use(notFoundHandler);
app.use(errorHandler);
