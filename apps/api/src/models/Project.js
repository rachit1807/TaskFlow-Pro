import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  color: { type: String, enum: ['violet', 'blue', 'green', 'orange', 'pink'], default: 'violet' },
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startDate: { type: Date, default: null },
  dueDate: { type: Date, default: null },
}, { timestamps: true });

projectSchema.index({ workspace: 1, name: 1 });

export default mongoose.model('Project', projectSchema);
