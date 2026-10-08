import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import Notification from '../models/Notification.js';

const router = Router();
router.use(requireAuth, requireWorkspace);

router.get('/', async (request, response) => {
  const limit = Math.max(1, Math.min(100, Number.parseInt(request.query.limit, 10) || 30));
  const filter = { workspace: request.workspace._id, recipient: request.user._id };
  if (request.query.unread === 'true') filter.readAt = null;
  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(limit).populate('actor', 'name avatarUrl'),
    Notification.countDocuments({ workspace: request.workspace._id, recipient: request.user._id, readAt: null }),
  ]);
  return response.json({ notifications, unreadCount });
});

router.patch('/:notificationId/read', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.notificationId)) return response.status(400).json({ error: { message: 'Notification ID is invalid.' } });
  const notification = await Notification.findOneAndUpdate({ _id: request.params.notificationId, workspace: request.workspace._id, recipient: request.user._id }, { $set: { readAt: new Date() } }, { new: true });
  if (!notification) return response.status(404).json({ error: { message: 'Notification not found.' } });
  return response.json({ notification });
});

router.post('/read-all', async (request, response) => {
  const result = await Notification.updateMany({ workspace: request.workspace._id, recipient: request.user._id, readAt: null }, { $set: { readAt: new Date() } });
  return response.json({ updated: result.modifiedCount });
});

export default router;
