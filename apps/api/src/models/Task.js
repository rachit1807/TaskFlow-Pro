import mongoose from 'mongoose';
import { TASK_STATUSES, TASK_PRIORITIES } from '@taskflow/shared';

const taskSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  key: { type: String, required: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 10000, default: '' },
  status: { type: String, enum: TASK_STATUSES, default: TASK_STATUSES[0], index: true },
  priority: { type: String, enum: TASK_PRIORITIES, default: 'Medium', index: true },
  assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  labels: [{ type: String, trim: true, maxlength: 32 }],
  dueDate: { type: Date, default: null, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  completedAt: { type: Date, default: null },
  archivedAt: { type: Date, default: null },
}, { timestamps: true });

taskSchema.index({ workspace: 1, key: 1 }, { unique: true });
taskSchema.index({ workspace: 1, status: 1, updatedAt: -1 });
taskSchema.index({ workspace: 1, assignees: 1, dueDate: 1 });
taskSchema.index({ title: 'text', description: 'text', key: 'text' });

export default mongoose.model('Task', taskSchema);
