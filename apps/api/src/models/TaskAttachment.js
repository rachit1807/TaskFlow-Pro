import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName: { type: String, required: true, maxlength: 180 },
  contentType: { type: String, required: true, maxlength: 120 },
  size: { type: Number, required: true, max: 5 * 1024 * 1024 },
  data: { type: Buffer, required: true, select: false },
}, { timestamps: true });

attachmentSchema.index({ workspace: 1, task: 1, createdAt: -1 });

export default mongoose.model('TaskAttachment', attachmentSchema);
