import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import Membership from '../models/Membership.js';
import { requireAuth, cookieOptions } from '../middleware/requireAuth.js';

const router = Router();
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { message: 'Too many attempts. Wait a little and try again.' } } });
const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(72),
  workspaceName: z.string().trim().min(2).max(80),
});
const loginSchema = z.object({ email: z.email().transform((value) => value.toLowerCase()), password: z.string().min(1).max(72) });

function issueSession(user, response) {
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d', issuer: 'taskflow-pro' });
  response.cookie('taskflow_session', token, { ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
}

function makeSlug(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 46) || 'workspace';
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

router.post('/register', authLimit, async (request, response) => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return response.status(503).json({ error: { message: 'Set a JWT_SECRET of at least 32 characters in .env.' } });
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: { message: 'Check the form fields and try again.', details: parsed.error.flatten().fieldErrors } });
  const { name, email, password, workspaceName } = parsed.data;
  if (await User.exists({ email })) return response.status(409).json({ error: { message: 'An account with this email already exists.' } });

  const user = new User({ name, email });
  await user.setPassword(password);
  await user.save();
  let workspace;
  try {
    workspace = await Workspace.create({ name: workspaceName, slug: makeSlug(workspaceName), createdBy: user._id });
    await Membership.create({ workspace: workspace._id, user: user._id, role: 'owner' });
    user.lastLoginAt = new Date();
    await user.save();
    issueSession(user, response);
    return response.status(201).json({ user: user.toSafeObject(), workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, role: 'owner' } });
  } catch (error) {
    if (workspace) await Workspace.deleteOne({ _id: workspace._id });
    await User.deleteOne({ _id: user._id });
    throw error;
  }
});

router.post('/login', authLimit, async (request, response) => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return response.status(503).json({ error: { message: 'Authentication is not configured yet.' } });
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: { message: 'Enter a valid email and password.' } });
  const user = await User.findOne({ email: parsed.data.email }).select('+passwordHash');
  if (!user || !(await user.verifyPassword(parsed.data.password))) return response.status(401).json({ error: { message: 'Email or password is incorrect.' } });
  user.lastLoginAt = new Date();
  await user.save();
  issueSession(user, response);
  const memberships = await Membership.find({ user: user._id }).populate('workspace', 'name slug');
  return response.json({ user: user.toSafeObject(), workspaces: memberships.map(({ workspace, role }) => ({ id: workspace.id, name: workspace.name, slug: workspace.slug, role })) });
});

router.post('/logout', (_request, response) => {
  response.clearCookie('taskflow_session', cookieOptions());
  return response.status(204).end();
});

router.get('/me', requireAuth, async (request, response) => {
  const memberships = await Membership.find({ user: request.user._id }).populate('workspace', 'name slug');
  return response.json({ user: request.user.toSafeObject(), workspaces: memberships.map(({ workspace, role }) => ({ id: workspace.id, name: workspace.name, slug: workspace.slug, role })) });
});

router.patch('/profile', requireAuth, async (request, response) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(80) }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: { message: 'Enter a name between 2 and 80 characters.' } });
  request.user.name = parsed.data.name;
  await request.user.save();
  return response.json({ user: request.user.toSafeObject() });
});

export default router;
