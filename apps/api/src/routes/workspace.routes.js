import { Router } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireWorkspace, requireWorkspaceRole } from '../middleware/requireWorkspace.js';
import Membership from '../models/Membership.js';
import Invitation from '../models/Invitation.js';
import Activity from '../models/Activity.js';
import User from '../models/User.js';

const router = Router();
router.use(requireAuth);

router.get('/members', requireWorkspace, async (request, response) => {
  const members = await Membership.find({ workspace: request.workspace._id }).sort({ joinedAt: 1 }).populate('user', 'name email avatarUrl lastLoginAt');
  return response.json({ members: members.map((membership) => ({ id: membership.id, user: membership.user.toSafeObject ? membership.user.toSafeObject() : { id: membership.user.id, name: membership.user.name, email: membership.user.email, avatarUrl: membership.user.avatarUrl }, role: membership.role, joinedAt: membership.joinedAt })) });
});

router.post('/invitations', requireWorkspace, requireWorkspaceRole('owner', 'admin', 'manager'), async (request, response) => {
  const parsed = z.object({ email: z.email().transform((value) => value.toLowerCase()), role: z.enum(['admin', 'manager', 'employee']).default('employee') }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: { message: 'Enter a valid email address and role.' } });
  if (request.membership.role === 'manager' && parsed.data.role !== 'employee') return response.status(403).json({ error: { message: 'Managers can invite employees only.' } });
  if (parsed.data.role === 'admin' && request.membership.role !== 'owner') return response.status(403).json({ error: { message: 'Only the workspace owner can invite an admin.' } });
  const invitee = await User.findOne({ email: parsed.data.email }).select('_id');
  if (invitee && await Membership.exists({ workspace: request.workspace._id, user: invitee._id })) return response.status(409).json({ error: { message: 'This person is already in the workspace.' } });
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const invitation = await Invitation.findOneAndUpdate(
    { workspace: request.workspace._id, email: parsed.data.email, acceptedAt: null },
    { $set: { role: parsed.data.role, tokenHash, invitedBy: request.user._id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  await Activity.create({ workspace: request.workspace._id, actor: request.user._id, entityType: 'member', entityId: invitation._id, action: 'member.invited', details: { email: invitation.email, role: invitation.role } });
  const webOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  return response.status(201).json({ invitation: { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt, inviteUrl: `${webOrigin}/?invite=${rawToken}` } });
});

router.post('/invitations/accept', async (request, response) => {
  const token = z.string().min(30).max(100).safeParse(request.body?.token);
  if (!token.success) return response.status(400).json({ error: { message: 'Invitation link is invalid.' } });
  const tokenHash = createHash('sha256').update(token.data).digest('hex');
  const invitation = await Invitation.findOne({ tokenHash, acceptedAt: null, expiresAt: { $gt: new Date() } });
  if (!invitation) return response.status(404).json({ error: { message: 'This invitation has expired or was already used.' } });
  if (invitation.email !== request.user.email) return response.status(403).json({ error: { message: `Sign in with ${invitation.email} to accept this invitation.` } });
  const membership = await Membership.findOneAndUpdate({ workspace: invitation.workspace, user: request.user._id }, { $setOnInsert: { role: invitation.role, joinedAt: new Date() } }, { new: true, upsert: true });
  invitation.acceptedAt = new Date();
  await invitation.save();
  await Activity.create({ workspace: invitation.workspace, actor: request.user._id, entityType: 'member', entityId: membership._id, action: 'member.joined' });
  return response.json({ workspace: invitation.workspace, role: membership.role });
});

router.patch('/members/:membershipId', requireWorkspace, requireWorkspaceRole('owner', 'admin'), async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.membershipId)) return response.status(400).json({ error: { message: 'Membership ID is invalid.' } });
  const parsed = z.object({ role: z.enum(['admin', 'manager', 'employee']) }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: { message: 'Choose a valid workspace role.' } });
  const membership = await Membership.findOne({ _id: request.params.membershipId, workspace: request.workspace._id });
  if (!membership) return response.status(404).json({ error: { message: 'Workspace member not found.' } });
  if (membership.role === 'owner' || (request.membership.role !== 'owner' && (membership.role === 'admin' || parsed.data.role === 'admin'))) return response.status(403).json({ error: { message: 'Only the workspace owner can manage owner or admin access.' } });
  membership.role = parsed.data.role;
  await membership.save();
  await Activity.create({ workspace: request.workspace._id, actor: request.user._id, entityType: 'member', entityId: membership._id, action: 'member.role_changed', details: { role: membership.role } });
  return response.json({ member: membership });
});

router.delete('/members/:membershipId', requireWorkspace, requireWorkspaceRole('owner', 'admin'), async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.membershipId)) return response.status(400).json({ error: { message: 'Membership ID is invalid.' } });
  const membership = await Membership.findOne({ _id: request.params.membershipId, workspace: request.workspace._id });
  if (!membership) return response.status(404).json({ error: { message: 'Workspace member not found.' } });
  if (membership.role === 'owner' || (membership.role === 'admin' && request.membership.role !== 'owner')) return response.status(403).json({ error: { message: 'Only the workspace owner can remove an admin.' } });
  await membership.deleteOne();
  await Activity.create({ workspace: request.workspace._id, actor: request.user._id, entityType: 'member', entityId: membership._id, action: 'member.removed', details: { userId: membership.user } });
  return response.status(204).end();
});

export default router;
