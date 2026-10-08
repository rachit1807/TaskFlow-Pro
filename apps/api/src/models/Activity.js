import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  entityType: { type: String, enum: ['project', 'task', 'comment', 'member'], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  action: { type: String, required: true, maxlength: 64 },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } });

activitySchema.index({ workspace: 1, createdAt: -1 });

export default mongoose.model('Activity', activitySchema);
