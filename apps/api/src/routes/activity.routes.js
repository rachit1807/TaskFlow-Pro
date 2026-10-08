import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import Activity from '../models/Activity.js';

const router = Router();
router.use(requireAuth, requireWorkspace);

router.get('/', async (request, response) => {
  const limit = Math.max(1, Math.min(100, Number.parseInt(request.query.limit, 10) || 30));
  const filter = { workspace: request.workspace._id };
  if (request.query.entityType) filter.entityType = request.query.entityType;
  const [activities, total] = await Promise.all([
    Activity.find(filter).sort({ createdAt: -1 }).limit(limit).populate('actor', 'name avatarUrl'),
    Activity.countDocuments(filter),
  ]);
  return response.json({ activities, total });
});

export default router;
