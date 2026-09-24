const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fileRepository = require('../db/repositories/fileRepository');
const messageRepository = require('../db/repositories/messageRepository');
const storageService = require('../storage/storageService');

class FileController {
  async uploadFile(req, res) {
    try {
      const { groupId } = req.params;
      const uploaderId = req.user.id;

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded or file rejected by security filter.' });
      }

      const fileId = 'fil_' + uuidv4().replace(/-/g, '').slice(0, 16);
      const ext = path.extname(req.file.originalname).toLowerCase();
      const storageKey = `${fileId}${ext}`;

      // Move file from temp upload folder to safe storage
      await storageService.saveFile(req.file.path, storageKey);

      // Record in files repository
      const fileRecord = await fileRepository.create({
        id: fileId,
        groupId,
        uploaderId,
        filename: req.file.originalname,
        storageKey,
        mimeType: req.file.mimetype || 'application/octet-stream',
        size: req.file.size,
      });

      // Automatically create a chat message referencing the attachment
      const messageId = 'msg_' + uuidv4().replace(/-/g, '').slice(0, 16);
      const chatMessage = await messageRepository.create({
        id: messageId,
        groupId,
        senderId: uploaderId,
        content: `Shared file: ${req.file.originalname}`,
        messageType: 'file',
        fileId: fileId,
      });

      // Broadcast to socket room
      const io = req.app.get('io');
      if (io) {
        io.to(`group_${groupId}`).emit('file:uploaded', { file: fileRecord });
        io.to(`group_${groupId}`).emit('chat:message', chatMessage);
      }

      return res.status(201).json({
        message: 'File uploaded and shared successfully.',
        file: fileRecord,
        chatMessage,
      });
    } catch (err) {
      console.error('File upload error:', err);
      return res.status(500).json({ error: 'Failed to process file upload.' });
    }
  }

  async getFiles(req, res) {
    try {
      const { groupId } = req.params;
      const { category = 'all', search = '', sort = 'newest' } = req.query;
      const limit = parseInt(req.query.limit || '100', 10);
      const offset = parseInt(req.query.offset || '0', 10);

      const files = await fileRepository.listGroupFiles(groupId, {
        category,
        search,
        sort,
        limit,
        offset,
      });

      const stats = await fileRepository.countGroupFiles(groupId);

      return res.json({
        files,
        total: stats.count,
        totalSize: stats.totalSize,
      });
    } catch (err) {
      console.error('Get files error:', err);
      return res.status(500).json({ error: 'Failed to retrieve group files.' });
    }
  }

  async downloadFile(req, res) {
    try {
      const { groupId, fileId } = req.params;

      const file = await fileRepository.findById(fileId);
      if (!file || file.group_id !== groupId) {
        return res.status(404).json({ error: 'File not found in this group.' });
      }

      let stream;
      try {
        stream = await storageService.getReadStream(file.storage_key);
      } catch (e) {
        return res.status(404).json({ error: 'File data is not found on storage disk.' });
      }

      // Safe ASCII filename fallback for Content-Disposition header
      const safeFilename = encodeURIComponent(file.filename);
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"; filename*=UTF-8''${safeFilename}`);
      res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
      res.setHeader('Content-Length', file.size);

      stream.pipe(res);
    } catch (err) {
      console.error('Download file error:', err);
      return res.status(500).json({ error: 'Failed to download file.' });
    }
  }

  async previewFile(req, res) {
    try {
      const { groupId, fileId } = req.params;

      const file = await fileRepository.findById(fileId);
      if (!file || file.group_id !== groupId) {
        return res.status(404).json({ error: 'File not found in this group.' });
      }

      let stream;
      try {
        stream = await storageService.getReadStream(file.storage_key);
      } catch (e) {
        return res.status(404).json({ error: 'File data is not found on storage disk.' });
      }

      const mime = file.mime_type.toLowerCase();
      const isImage = mime.startsWith('image/');
      const isPdf = mime.includes('pdf');
      const isText = mime.startsWith('text/') || mime.includes('json') || mime.includes('csv');
      const isAudio = mime.startsWith('audio/');
      const isVideo = mime.startsWith('video/');

      const canPreview = isImage || isPdf || isText || isAudio || isVideo;

      if (!canPreview) {
        return res.status(415).json({
          error: 'Preview unavailable for this format.',
          canPreview: false,
          downloadUrl: `/api/groups/${groupId}/files/${fileId}/download`,
        });
      }

      // Stream inline for browser viewing
      res.setHeader('Content-Type', file.mime_type);
      res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
      res.setHeader('Content-Length', file.size);

      stream.pipe(res);
    } catch (err) {
      console.error('Preview file error:', err);
      return res.status(500).json({ error: 'Failed to stream preview.' });
    }
  }
}

module.exports = new FileController();
