import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  slug: { type: String, required: true, unique: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
  settings: {
    weekStartsOn: { type: Number, min: 0, max: 6, default: 1 },
    defaultTaskStatus: { type: String, default: 'Backlog' },
  },
}, { timestamps: true });

export default mongoose.model('Workspace', workspaceSchema);
