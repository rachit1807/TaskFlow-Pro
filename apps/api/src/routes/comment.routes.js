import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import Task from '../models/Task.js';
import TaskComment from '../models/TaskComment.js';
import Activity from '../models/Activity.js';
import Notification from '../models/Notification.js';

const router = Router({ mergeParams: true });
router.use(requireAuth, requireWorkspace);

async function findTask(request) {
  if (!mongoose.isValidObjectId(request.params.taskId)) return null;
  return Task.findOne({ _id: request.params.taskId, workspace: request.workspace._id, archivedAt: null });
}

router.get('/', async (request, response) => {
  const task = await findTask(request);
  if (!task) return response.status(404).json({ error: { message: 'Task not found.' } });
  const comments = await TaskComment.find({ task: task._id, workspace: request.workspace._id, deletedAt: null }).sort({ createdAt: 1 }).populate('author', 'name email avatarUrl');
  return response.json({ comments });
});

router.post('/', async (request, response) => {
  const task = await findTask(request);
  if (!task) return response.status(404).json({ error: { message: 'Task not found.' } });
  const parsed = z.object({ body: z.string().trim().min(1).max(4000) }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: { message: 'A comment must be between 1 and 4,000 characters.' } });
  const comment = await TaskComment.create({ workspace: request.workspace._id, task: task._id, author: request.user._id, body: parsed.data.body });
  await comment.populate('author', 'name email avatarUrl');
  await Activity.create({ workspace: request.workspace._id, actor: request.user._id, entityType: 'comment', entityId: comment._id, action: 'comment.created', details: { taskId: task.id, taskKey: task.key } });
  const recipients = [...new Set([task.createdBy.toString(), ...task.assignees.map((id) => id.toString())])].filter((id) => id !== request.user.id);
  if (recipients.length) await Notification.insertMany(recipients.map((recipient) => ({ workspace: request.workspace._id, recipient, actor: request.user._id, type: 'comment_added', message: `${request.user.name} commented on ${task.key}`, entityType: 'comment', entityId: comment._id })));
  return response.status(201).json({ comment });
});

router.patch('/:commentId', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.commentId)) return response.status(400).json({ error: { message: 'Comment ID is invalid.' } });
  const parsed = z.object({ body: z.string().trim().min(1).max(4000) }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: { message: 'A comment must be between 1 and 4,000 characters.' } });
  const comment = await TaskComment.findOne({ _id: request.params.commentId, task: request.params.taskId, workspace: request.workspace._id, deletedAt: null });
  if (!comment) return response.status(404).json({ error: { message: 'Comment not found.' } });
  if (!comment.author.equals(request.user._id) && !['owner', 'admin'].includes(request.membership.role)) return response.status(403).json({ error: { message: 'Only the author or a workspace admin can edit this comment.' } });
  comment.body = parsed.data.body;
  comment.editedAt = new Date();
  await comment.save();
  await comment.populate('author', 'name email avatarUrl');
  return response.json({ comment });
});

router.delete('/:commentId', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.commentId)) return response.status(400).json({ error: { message: 'Comment ID is invalid.' } });
  const comment = await TaskComment.findOne({ _id: request.params.commentId, task: request.params.taskId, workspace: request.workspace._id, deletedAt: null });
  if (!comment) return response.status(404).json({ error: { message: 'Comment not found.' } });
  if (!comment.author.equals(request.user._id) && !['owner', 'admin'].includes(request.membership.role)) return response.status(403).json({ error: { message: 'Only the author or a workspace admin can delete this comment.' } });
  comment.deletedAt = new Date();
  await comment.save();
  return response.status(204).end();
});

export default router;
