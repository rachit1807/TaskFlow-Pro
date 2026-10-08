import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import Task from '../models/Task.js';
import TaskAttachment from '../models/TaskAttachment.js';
import Activity from '../models/Activity.js';

const router = Router({ mergeParams: true });
const maxBytes = 5 * 1024 * 1024;
const allowedTypes = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'text/plain', 'text/csv', 'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: 1 } });

function contentMatchesType(buffer, type) {
  if (type === 'application/pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (type === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (type === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  if (type === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (type === 'application/zip' || type.startsWith('application/vnd.openxmlformats-officedocument.')) return buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (type === 'text/plain' || type === 'text/csv') return !buffer.includes(0);
  return false;
}

router.use(requireAuth, requireWorkspace);

async function findTask(request, response) {
  if (!mongoose.isValidObjectId(request.params.taskId)) {
    response.status(400).json({ error: { message: 'Task ID is invalid.' } });
    return null;
  }
  const task = await Task.findOne({ _id: request.params.taskId, workspace: request.workspace._id, archivedAt: null });
  if (!task) response.status(404).json({ error: { message: 'Task not found.' } });
  return task;
}

router.get('/', async (request, response) => {
  const task = await findTask(request, response);
  if (!task) return;
  const attachments = await TaskAttachment.find({ workspace: request.workspace._id, task: task._id }).sort({ createdAt: -1 }).populate('uploadedBy', 'name');
  return response.json({ attachments });
});

router.post('/', (request, response, next) => upload.single('file')(request, response, (error) => {
  if (error) return response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: { message: error.code === 'LIMIT_FILE_SIZE' ? 'Files must be 5 MB or smaller.' : 'The selected file could not be uploaded.' } });
  return next();
}), async (request, response) => {
  const task = await findTask(request, response);
  if (!task) return;
  if (!request.file) return response.status(400).json({ error: { message: 'Choose a file to attach.' } });
  if (!allowedTypes.has(request.file.mimetype)) return response.status(415).json({ error: { message: 'This file type is not supported.' } });
  if (!contentMatchesType(request.file.buffer, request.file.mimetype)) return response.status(415).json({ error: { message: 'The file contents do not match the selected file type.' } });
  const elevated = ['owner', 'admin', 'manager'].includes(request.membership.role);
  if (!elevated && !task.createdBy.equals(request.user._id) && !task.assignees.some((id) => id.equals(request.user._id))) return response.status(403).json({ error: { message: 'You can attach files to tasks assigned to you or created by you.' } });
  const attachment = await TaskAttachment.create({ workspace: request.workspace._id, task: task._id, uploadedBy: request.user._id, fileName: request.file.originalname.replace(/[\\/\r\n\0]/g, '_').slice(0, 180), contentType: request.file.mimetype, size: request.file.size, data: request.file.buffer });
  await Activity.create({ workspace: request.workspace._id, actor: request.user._id, entityType: 'task', entityId: task._id, action: 'task.attachment_added', details: { fileName: attachment.fileName } });
  await attachment.populate('uploadedBy', 'name');
  return response.status(201).json({ attachment: { id: attachment.id, fileName: attachment.fileName, contentType: attachment.contentType, size: attachment.size, uploadedBy: attachment.uploadedBy, createdAt: attachment.createdAt } });
});

router.get('/:attachmentId', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.attachmentId)) return response.status(400).json({ error: { message: 'Attachment ID is invalid.' } });
  const attachment = await TaskAttachment.findOne({ _id: request.params.attachmentId, task: request.params.taskId, workspace: request.workspace._id }).select('+data');
  if (!attachment) return response.status(404).json({ error: { message: 'Attachment not found.' } });
  const safeName = encodeURIComponent(attachment.fileName).replace(/['()]/g, escape);
  response.set({ 'Content-Type': attachment.contentType, 'Content-Length': String(attachment.size), 'Content-Disposition': `attachment; filename*=UTF-8''${safeName}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  return response.send(attachment.data);
});

router.delete('/:attachmentId', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.attachmentId)) return response.status(400).json({ error: { message: 'Attachment ID is invalid.' } });
  const attachment = await TaskAttachment.findOne({ _id: request.params.attachmentId, task: request.params.taskId, workspace: request.workspace._id });
  if (!attachment) return response.status(404).json({ error: { message: 'Attachment not found.' } });
  const canDelete = attachment.uploadedBy.equals(request.user._id) || ['owner', 'admin', 'manager'].includes(request.membership.role);
  if (!canDelete) return response.status(403).json({ error: { message: 'You can remove your own attachments.' } });
  await attachment.deleteOne();
  return response.status(204).end();
});

export default router;
