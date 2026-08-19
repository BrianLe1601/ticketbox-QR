import express from 'express';
import cors from 'cors';
import { router } from './routes/index.js';
import { errorHandler } from './middlewares/error-handler.js';
import { notFoundHandler } from './middlewares/not-found.js';

export const app = express();

// Cho phép tất cả origin gọi API
app.use(cors());
app.use(express.json());

app.use('/api', router);

app.use(notFoundHandler);
app.use(errorHandler);