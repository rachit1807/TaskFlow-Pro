import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireWorkspace, requireWorkspaceRole } from '../middleware/requireWorkspace.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Activity from '../models/Activity.js';
import Membership from '../models/Membership.js';

const router = Router();
const createSchema = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(2000).optional(), color: z.enum(['violet', 'blue', 'green', 'orange', 'pink']).optional(), lead: z.string().optional(), startDate: z.iso.date().optional(), dueDate: z.iso.date().optional() });
const updateSchema = createSchema.partial();

router.use(requireAuth, requireWorkspace);

router.get('/', async (request, response) => {
  const includeArchived = request.query.includeArchived === 'true';
  const filter = { workspace: request.workspace._id, ...(includeArchived ? {} : { status: 'active' }) };
  const projects = await Project.aggregate([
    { $match: filter },
    { $lookup: { from: 'tasks', let: { projectId: '$_id', workspaceId: '$workspace' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$project', '$$projectId'] }, { $eq: ['$workspace', '$$workspaceId'] }, { $eq: ['$archivedAt', null] }] } } }, { $group: { _id: '$status', count: { $sum: 1 } } }], as: 'taskCounts' } },
    { $sort: { updatedAt: -1 } },
  ]);
  return response.json({ projects: projects.map((project) => ({ ...project, taskCounts: Object.fromEntries(project.taskCounts.map(({ _id, count }) => [_id, count])) })) });
});

router.post('/', requireWorkspaceRole('owner', 'admin', 'manager'), async (request, response) => {
  const parsed = createSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: { message: 'Check the project details.', details: parsed.error.flatten().fieldErrors } });
  const { lead, ...fields } = parsed.data;
  if (lead && (!mongoose.isValidObjectId(lead) || !(await Membership.exists({ workspace: request.workspace._id, user: lead })))) return response.status(400).json({ error: { message: 'The project lead must be a member of this workspace.' } });
  const project = await Project.create({ ...fields, workspace: request.workspace._id, createdBy: request.user._id, ...(lead ? { lead } : {}) });
  await Activity.create({ workspace: request.workspace._id, actor: request.user._id, entityType: 'project', entityId: project._id, action: 'project.created' });
  return response.status(201).json({ project });
});

router.get('/:projectId', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.projectId)) return response.status(400).json({ error: { message: 'Project ID is invalid.' } });
  const project = await Project.findOne({ _id: request.params.projectId, workspace: request.workspace._id });
  if (!project) return response.status(404).json({ error: { message: 'Project not found.' } });
  const counts = await Task.aggregate([{ $match: { project: project._id, workspace: request.workspace._id, archivedAt: null } }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
  return response.json({ project, taskCounts: Object.fromEntries(counts.map(({ _id, count }) => [_id, count])) });
});

router.patch('/:projectId', requireWorkspaceRole('owner', 'admin', 'manager'), async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.projectId)) return response.status(400).json({ error: { message: 'Project ID is invalid.' } });
  const parsed = updateSchema.safeParse(request.body);
  if (!parsed.success || Object.keys(parsed.data || {}).length === 0) return response.status(400).json({ error: { message: 'Provide valid project fields to update.', details: parsed.error?.flatten().fieldErrors } });
  if (parsed.data.lead && (!mongoose.isValidObjectId(parsed.data.lead) || !(await Membership.exists({ workspace: request.workspace._id, user: parsed.data.lead })))) return response.status(400).json({ error: { message: 'The project lead must be a member of this workspace.' } });
  const project = await Project.findOneAndUpdate({ _id: request.params.projectId, workspace: request.workspace._id }, { $set: parsed.data }, { new: true, runValidators: true });
  if (!project) return response.status(404).json({ error: { message: 'Project not found.' } });
  await Activity.create({ workspace: request.workspace._id, actor: request.user._id, entityType: 'project', entityId: project._id, action: 'project.updated', details: { fields: Object.keys(parsed.data) } });
  return response.json({ project });
});

router.post('/:projectId/archive', requireWorkspaceRole('owner', 'admin', 'manager'), async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.projectId)) return response.status(400).json({ error: { message: 'Project ID is invalid.' } });
  const project = await Project.findOneAndUpdate({ _id: request.params.projectId, workspace: request.workspace._id }, [{ $set: { status: { $cond: [{ $eq: ['$status', 'archived'] }, 'active', 'archived'] } } }], { new: true });
  if (!project) return response.status(404).json({ error: { message: 'Project not found.' } });
  await Activity.create({ workspace: request.workspace._id, actor: request.user._id, entityType: 'project', entityId: project._id, action: project.status === 'archived' ? 'project.archived' : 'project.restored' });
  return response.json({ project });
});

export default router;
