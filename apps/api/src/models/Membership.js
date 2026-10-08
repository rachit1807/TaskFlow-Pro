import mongoose from 'mongoose';

const membershipSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['owner', 'admin', 'manager', 'employee'], default: 'employee' },
  joinedAt: { type: Date, default: Date.now },
}, { timestamps: true });

membershipSchema.index({ workspace: 1, user: 1 }, { unique: true });

export default mongoose.model('Membership', membershipSchema);
