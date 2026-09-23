import React from 'react';
import { FileText, Image as ImageIcon, Download, ExternalLink, FileSpreadsheet, Presentation } from 'lucide-react';
import { api } from '../../services/api';

interface AttachmentCardProps {
  fileId: string;
  filename: string;
  mimeType?: string;
  size?: number;
  groupId: string;
  onPreview?: (fileId: string, filename: string, mimeType?: string) => void;
}

export const AttachmentCard: React.FC<AttachmentCardProps> = ({
  fileId,
  filename,
  mimeType = '',
  size = 0,
  groupId,
  onPreview,
}) => {
  const formatSize = (bytes: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = () => {
    const m = mimeType.toLowerCase();
    const fn = filename.toLowerCase();
    if (m.startsWith('image/') || fn.endsWith('.png') || fn.endsWith('.jpg') || fn.endsWith('.jpeg')) {
      return <ImageIcon size={22} color="var(--brand-primary)" />;
    }
    if (m.includes('spreadsheet') || fn.endsWith('.xls') || fn.endsWith('.xlsx') || fn.endsWith('.csv')) {
      return <FileSpreadsheet size={22} color="var(--success)" />;
    }
    if (m.includes('presentation') || fn.endsWith('.ppt') || fn.endsWith('.pptx')) {
      return <Presentation size={22} color="var(--warning)" />;
    }
    return <FileText size={22} color="var(--brand-primary)" />;
  };

  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType.includes('pdf');
  const isText = mimeType.startsWith('text/');
  const canPreview = isImage || isPdf || isText;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    api.downloadFile(groupId, fileId, filename);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        marginTop: '8px',
        maxWidth: '340px',
        gap: '12px',
        cursor: canPreview ? 'pointer' : 'default',
      }}
      onClick={() => {
        if (canPreview && onPreview) {
          onPreview(fileId, filename, mimeType);
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-surface-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {getFileIcon()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {filename}
          </div>
          <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
            {formatSize(size)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        {canPreview && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onPreview) onPreview(fileId, filename, mimeType);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Preview file"
          >
            <ExternalLink size={16} />
          </button>
        )}
        <button
          onClick={handleDownload}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--brand-primary)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Download file"
        >
          <Download size={16} />
        </button>
      </div>
    </div>
  );
};
