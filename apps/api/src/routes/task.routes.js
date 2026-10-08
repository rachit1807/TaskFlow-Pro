import { Router } from 'express';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { TASK_STATUSES, TASK_PRIORITIES } from '@taskflow/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import Membership from '../models/Membership.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Activity from '../models/Activity.js';
import Notification from '../models/Notification.js';

const router = Router();
const taskFields = {
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(10000),
  project: z.string(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  assignees: z.array(z.string()).max(25),
  labels: z.array(z.string().trim().min(1).max(32)).max(20),
  dueDate: z.iso.datetime().nullable(),
};
const createSchema = z.object({ title: taskFields.title, description: taskFields.description.optional(), project: taskFields.project, status: taskFields.status.optional(), priority: taskFields.priority.optional(), assignees: taskFields.assignees.optional(), labels: taskFields.labels.optional(), dueDate: taskFields.dueDate.optional() });
const updateSchema = z.object({ title: taskFields.title.optional(), description: taskFields.description.optional(), project: taskFields.project.optional(), status: taskFields.status.optional(), priority: taskFields.priority.optional(), assignees: taskFields.assignees.optional(), labels: taskFields.labels.optional(), dueDate: taskFields.dueDate.optional() });

router.use(requireAuth, requireWorkspace);

async function validAssignees(ids, workspaceId) {
  if (!ids?.length) return true;
  if (ids.some((id) => !mongoose.isValidObjectId(id))) return false;
  const count = await Membership.countDocuments({ workspace: workspaceId, user: { $in: ids } });
  return count === new Set(ids).size;
}

function taskFilter(request) {
  const filter = { workspace: request.workspace._id, archivedAt: null };
  if (request.query.project) filter.project = request.query.project;
  if (TASK_STATUSES.includes(request.query.status)) filter.status = request.query.status;
  if (TASK_PRIORITIES.includes(request.query.priority)) filter.priority = request.query.priority;
  if (request.query.assignee === 'me') filter.assignees = request.user._id;
  if (request.query.search) filter.$text = { $search: String(request.query.search).slice(0, 100) };
  return filter;
}

router.get('/', async (request, response) => {
  const page = Math.max(1, Math.min(10000, Number.parseInt(request.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(100, Number.parseInt(request.query.limit, 10) || 50));
  const filter = taskFilter(request);
  const [tasks, total] = await Promise.all([
    Task.find(filter).sort({ dueDate: 1, updatedAt: -1 }).skip((page - 1) * limit).limit(limit).populate('assignees', 'name email avatarUrl').populate('createdBy', 'name email').populate('project', 'name color'),
    Task.countDocuments(filter),
  ]);
  return response.json({ tasks, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

router.post('/', async (request, response) => {
  const parsed = createSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: { message: 'Check the task details.', details: parsed.error.flatten().fieldErrors } });
  const data = parsed.data;
  if (!mongoose.isValidObjectId(data.project)) return response.status(400).json({ error: { message: 'Project ID is invalid.' } });
  const project = await Project.findOne({ _id: data.project, workspace: request.workspace._id, status: 'active' });
  if (!project) return response.status(404).json({ error: { message: 'Active project not found in this workspace.' } });
  if (!(await validAssignees(data.assignees, request.workspace._id))) return response.status(400).json({ error: { message: 'Every assignee must be a member of this workspace.' } });
  const key = `TF-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
  const task = await Task.create({ ...data, assignees: data.assignees ?? [request.user._id], key, workspace: request.workspace._id, createdBy: request.user._id, ...(data.status === 'Done' ? { completedAt: new Date() } : {}) });
  await Activity.create({ workspace: request.workspace._id, actor: request.user._id, entityType: 'task', entityId: task._id, action: 'task.created', details: { title: task.title, key: task.key } });
  const recipients = (data.assignees || []).filter((id) => id !== request.user.id);
  if (recipients.length) await Notification.insertMany(recipients.map((recipient) => ({ workspace: request.workspace._id, recipient, actor: request.user._id, type: 'task_assigned', message: `${request.user.name} assigned you ${task.key}: ${task.title}`, entityId: task._id })));
  await task.populate([{ path: 'assignees', select: 'name email avatarUrl' }, { path: 'createdBy', select: 'name email' }, { path: 'project', select: 'name color' }]);
  return response.status(201).json({ task });
});

router.get('/:taskId', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.taskId)) return response.status(400).json({ error: { message: 'Task ID is invalid.' } });
  const task = await Task.findOne({ _id: request.params.taskId, workspace: request.workspace._id, archivedAt: null }).populate('assignees', 'name email avatarUrl').populate('createdBy', 'name email').populate('project', 'name color');
  if (!task) return response.status(404).json({ error: { message: 'Task not found.' } });
  return response.json({ task });
});

router.patch('/:taskId', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.taskId)) return response.status(400).json({ error: { message: 'Task ID is invalid.' } });
  const parsed = updateSchema.safeParse(request.body);
  if (!parsed.success || Object.keys(parsed.data || {}).length === 0) return response.status(400).json({ error: { message: 'Provide valid task fields to update.', details: parsed.error?.flatten().fieldErrors } });
  const changes = parsed.data;
  if (changes.project && (!mongoose.isValidObjectId(changes.project) || !(await Project.exists({ _id: changes.project, workspace: request.workspace._id, status: 'active' })))) return response.status(404).json({ error: { message: 'Active project not found in this workspace.' } });
  if (!(await validAssignees(changes.assignees, request.workspace._id))) return response.status(400).json({ error: { message: 'Every assignee must be a member of this workspace.' } });
  const task = await Task.findOne({ _id: request.params.taskId, workspace: request.workspace._id, archivedAt: null });
  if (!task) return response.status(404).json({ error: { message: 'Task not found.' } });
  const elevated = ['owner', 'admin', 'manager'].includes(request.membership.role);
  const canEdit = elevated || task.createdBy.equals(request.user._id) || task.assignees.some((id) => id.equals(request.user._id));
  if (!canEdit) return response.status(403).json({ error: { message: 'You can update tasks assigned to you or created by you.' } });
  const changedFields = Object.keys(changes);
  const previousAssignees = task.assignees.map((id) => id.toString());
  Object.assign(task, changes);
  if (changes.status === 'Done') task.completedAt = task.completedAt || new Date();
  if (changes.status && changes.status !== 'Done') task.completedAt = null;
  await task.save();
  await Activity.create({ workspace: request.workspace._id, actor: request.user._id, entityType: 'task', entityId: task._id, action: changes.status ? 'task.status_changed' : 'task.updated', details: { fields: changedFields, status: task.status } });
  if (changes.assignees) {
    const newAssignees = changes.assignees.filter((id) => !previousAssignees.includes(id) && id !== request.user.id);
    if (newAssignees.length) await Notification.insertMany(newAssignees.map((recipient) => ({ workspace: request.workspace._id, recipient, actor: request.user._id, type: 'task_assigned', message: `${request.user.name} assigned you ${task.key}: ${task.title}`, entityId: task._id })));
  }
  await task.populate([{ path: 'assignees', select: 'name email avatarUrl' }, { path: 'createdBy', select: 'name email' }, { path: 'project', select: 'name color' }]);
  return response.json({ task });
});

router.post('/:taskId/archive', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.taskId)) return response.status(400).json({ error: { message: 'Task ID is invalid.' } });
  const task = await Task.findOneAndUpdate({ _id: request.params.taskId, workspace: request.workspace._id, archivedAt: null }, { $set: { archivedAt: new Date() } }, { new: true });
  if (!task) return response.status(404).json({ error: { message: 'Task not found.' } });
  await Activity.create({ workspace: request.workspace._id, actor: request.user._id, entityType: 'task', entityId: task._id, action: 'task.archived' });
  return response.status(204).end();
});

export default router;
