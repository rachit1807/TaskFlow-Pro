import mongoose from 'mongoose';
import Membership from '../models/Membership.js';

export async function requireWorkspace(request, response, next) {
  try {
    const requestedId = request.get('x-workspace-id');
    const filter = { user: request.user._id };
    if (requestedId) {
      if (!mongoose.isValidObjectId(requestedId)) return response.status(400).json({ error: { message: 'Workspace ID is invalid.' } });
      filter.workspace = requestedId;
    }
    const membership = await Membership.findOne(filter).populate('workspace');
    if (!membership) return response.status(403).json({ error: { message: 'You do not have access to this workspace.' } });
    request.workspace = membership.workspace;
    request.membership = membership;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireWorkspaceRole(...roles) {
  return (request, response, next) => {
    if (!roles.includes(request.membership?.role)) return response.status(403).json({ error: { message: 'Your workspace role cannot perform this action.' } });
    return next();
  };
}
