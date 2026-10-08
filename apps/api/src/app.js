import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import authRouter from './routes/auth.routes.js';
import projectRouter from './routes/project.routes.js';
import taskRouter from './routes/task.routes.js';
import workspaceRouter from './routes/workspace.routes.js';
import commentRouter from './routes/comment.routes.js';
import notificationRouter from './routes/notification.routes.js';
import activityRouter from './routes/activity.routes.js';
import attachmentRouter from './routes/attachment.routes.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api/auth', authRouter);
app.use('/api/projects', projectRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/tasks/:taskId/comments', commentRouter);
app.use('/api/tasks/:taskId/attachments', attachmentRouter);
app.use('/api/workspace', workspaceRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/activity', activityRouter);

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'TaskFlow Pro API',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.use((_request, response) => response.status(404).json({ error: { message: 'Route not found' } }));

app.use((error, _request, response, _next) => {
  console.error(error);
  if (error.code === 11000) return response.status(409).json({ error: { message: 'A record with those details already exists.' } });
  response.status(error.status || 500).json({ error: { message: error.message || 'Internal server error' } });
});

export default app;
