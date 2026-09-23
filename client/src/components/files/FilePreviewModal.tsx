import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Download, FileText, ExternalLink, AlertTriangle } from 'lucide-react';
import { api, tokenStorage } from '../../services/api';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  fileId: string | null;
  filename: string | null;
  mimeType?: string;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  onClose,
  groupId,
  fileId,
  filename,
  mimeType = '',
}) => {
  if (!fileId || !filename) return null;

  const token = tokenStorage.get();
  const previewUrl = `/api/groups/${groupId}/files/${fileId}/preview?token=${token || ''}`;

  const isImage = mimeType.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(filename);
  const isPdf = mimeType.includes('pdf') || /\.pdf$/i.test(filename);
  const isText = mimeType.startsWith('text/') || /\.(txt|md|json|csv|log)$/i.test(filename);
  const isVideo = mimeType.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(filename);

  const canPreview = isImage || isPdf || isText || isVideo;

  const handleDownload = () => {
    api.downloadFile(groupId, fileId, filename);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={filename} maxWidth="800px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            minHeight: '360px',
            maxHeight: '65vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-app)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {isImage ? (
            <img
              src={previewUrl}
              alt={filename}
              style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }}
            />
          ) : isPdf ? (
            <iframe
              src={previewUrl}
              title={filename}
              style={{ width: '100%', height: '60vh', border: 'none' }}
            />
          ) : isVideo ? (
            <video
              src={previewUrl}
              controls
              style={{ maxWidth: '100%', maxHeight: '60vh' }}
            />
          ) : isText ? (
            <iframe
              src={previewUrl}
              title={filename}
              style={{ width: '100%', height: '50vh', border: 'none', background: '#fff' }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '14px',
                padding: '40px 20px',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'var(--bg-surface-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileText size={28} color="var(--brand-primary)" />
              </div>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Preview unavailable
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '340px', marginTop: '4px' }}>
                  In-browser preview is not supported for this file format. You can download and open it on your device.
                </p>
              </div>
              <Button variant="primary" onClick={handleDownload} icon={<Download size={16} />}>
                Download File
              </Button>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            MIME: {mimeType || 'binary'}
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button variant="secondary" onClick={handleDownload} icon={<Download size={15} />}>
              Download
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
