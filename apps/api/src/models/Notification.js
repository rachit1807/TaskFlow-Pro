import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  type: { type: String, enum: ['task_assigned', 'task_updated', 'comment_added', 'invitation'], required: true },
  message: { type: String, required: true, maxlength: 240 },
  entityType: { type: String, enum: ['project', 'task', 'comment'], default: 'task' },
  entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
  readAt: { type: Date, default: null },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
