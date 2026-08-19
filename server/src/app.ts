import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { checkDatabaseConnection } from "./database/pool.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";
import { authorize } from "./middlewares/authorize.js";
import { authenticate } from "./middlewares/authenticate.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { router } from "./routes/index.js";

export const app = express();

app.use(helmet());

app.use(
    cors({
        origin: env.CLIENT_URL,
        credentials: true,
    }),
);

app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));

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