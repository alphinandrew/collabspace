import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Avatar } from '../common/Avatar';
import { Button } from '../common/Button';
import { FilePreviewModal } from './FilePreviewModal';
import { Group, FileItem, api } from '../../services/api';
import {
  Search,
  Upload,
  Download,
  ExternalLink,
  Copy,
  Check,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Presentation,
  FolderArchive,
  ArrowUpDown,
  Filter,
} from 'lucide-react';

interface FileLibraryViewProps {
  group: Group;
}

export const FileLibraryView: React.FC<FileLibraryViewProps> = ({ group }) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalSize, setTotalSize] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('newest');

  // Preview state
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Upload progress
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getFiles(group.id, {
        category,
        search,
        sort,
      });
      setFiles(res.files);
      setTotalFiles(res.total);
      setTotalSize(res.totalSize);
    } catch (err) {
      console.error('Failed to load group files:', err);
    } finally {
      setLoading(false);
    }
  }, [group.id, category, search, sort]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadProgress(0);

    try {
      await api.uploadFileWithProgress(group.id, file, (percent) => {
        setUploadProgress(percent);
      });
      setUploadProgress(null);
      loadFiles();
    } catch (err: any) {
      setUploadError(err.message || 'File upload failed.');
      setUploadProgress(null);
    }

    e.target.value = '';
  };

  const handleCopyLink = async (file: FileItem) => {
    const downloadUrl = `${window.location.origin}/api/groups/${group.id}/files/${file.id}/download`;
    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopiedId(file.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.warn('Failed to copy to clipboard');
    }
  };

  const formatSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return '';
    }
  };

  const getFileIcon = (mime: string, filename: string) => {
    const m = mime.toLowerCase();
    const fn = filename.toLowerCase();
    if (m.startsWith('image/') || fn.endsWith('.png') || fn.endsWith('.jpg') || fn.endsWith('.jpeg')) {
      return <ImageIcon size={20} color="var(--brand-primary)" />;
    }
    if (m.includes('spreadsheet') || fn.endsWith('.xls') || fn.endsWith('.xlsx') || fn.endsWith('.csv')) {
      return <FileSpreadsheet size={20} color="var(--success)" />;
    }
    if (m.includes('presentation') || fn.endsWith('.ppt') || fn.endsWith('.pptx')) {
      return <Presentation size={20} color="var(--warning)" />;
    }
    return <FileText size={20} color="var(--brand-primary)" />;
  };

  const categories = [
    { id: 'all', label: 'All Files' },
    { id: 'documents', label: 'Documents' },
    { id: 'pdfs', label: 'PDFs' },
    { id: 'spreadsheets', label: 'Spreadsheets' },
    { id: 'presentations', label: 'Presentations' },
    { id: 'images', label: 'Images' },
    { id: 'videos', label: 'Videos' },
    { id: 'other', label: 'Other' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-app)',
        overflowY: 'auto',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Files & Documents
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {totalFiles} {totalFiles === 1 ? 'file' : 'files'} shared in #{group.name} ({formatSize(totalSize)})
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <Button
            variant="primary"
            onClick={() => fileInputRef.current?.click()}
            icon={<Upload size={16} />}
          >
            Upload File
          </Button>
        </div>
      </div>

      {/* Upload Progress Bar */}
      {uploadProgress !== null && (
        <div
          style={{
            padding: '10px 24px',
            backgroundColor: 'var(--bg-surface-elevated)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
            <span>Uploading file...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--brand-primary)' }} />
          </div>
        </div>
      )}

      {/* Filter, Search, and Sort Toolbar */}
      <div
        style={{
          padding: '14px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          backgroundColor: 'var(--bg-app)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
              minWidth: '240px',
              flex: 1,
            }}
          >
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search by filename or uploader..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                width: '100%',
              }}
            />
          </div>

          {/* Sort Dropdown */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
            }}
          >
            <ArrowUpDown size={14} color="var(--text-muted)" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <option value="newest" style={{ background: '#1E293B' }}>Newest First</option>
              <option value="oldest" style={{ background: '#1E293B' }}>Oldest First</option>
              <option value="filename" style={{ background: '#1E293B' }}>Filename (A-Z)</option>
              <option value="size" style={{ background: '#1E293B' }}>File Size</option>
            </select>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                fontWeight: 500,
                border: category === cat.id ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                background: category === cat.id ? 'var(--brand-primary-light)' : 'var(--bg-surface)',
                color: category === cat.id ? 'var(--brand-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all var(--transition-fast)',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* File List Table */}
      <div style={{ flex: 1, padding: '20px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="skeleton" style={{ height: '48px', width: '100%', borderRadius: '8px' }} />
            <div className="skeleton" style={{ height: '48px', width: '100%', borderRadius: '8px' }} />
            <div className="skeleton" style={{ height: '48px', width: '100%', borderRadius: '8px' }} />
          </div>
        ) : files.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              textAlign: 'center',
              gap: '12px',
              color: 'var(--text-muted)',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FolderArchive size={26} color="var(--brand-primary)" />
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
                No files shared yet
              </p>
              <p style={{ fontSize: '0.825rem', maxWidth: '340px', marginTop: '4px' }}>
                Files uploaded to #{group.name} will be permanently accessible here even when teammates are offline.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              icon={<Upload size={14} />}
            >
              Upload First Document
            </Button>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.04em',
                  }}
                >
                  <th style={{ padding: '12px 18px' }}>File Name</th>
                  <th style={{ padding: '12px 14px' }}>Size</th>
                  <th style={{ padding: '12px 14px' }}>Uploaded By</th>
                  <th style={{ padding: '12px 14px' }}>Date</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr
                    key={file.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--bg-surface-elevated)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {getFileIcon(file.mime_type, file.filename)}
                        </div>
                        <span
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                          }}
                          onClick={() => setPreviewFile(file)}
                        >
                          {file.filename}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 14px', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      {formatSize(file.size)}
                    </td>
                    <td style={{ padding: '14px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Avatar name={file.uploader_name} src={file.uploader_avatar} size="sm" />
                        <span style={{ fontSize: '0.825rem', color: 'var(--text-primary)' }}>
                          {file.uploader_name}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 14px', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                      {formatDate(file.created_at)}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => setPreviewFile(file)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: 'var(--radius-sm)',
                          }}
                          title="Preview"
                        >
                          <ExternalLink size={16} />
                        </button>
                        <button
                          onClick={() => api.downloadFile(group.id, file.id, file.filename)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--brand-primary)',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: 'var(--radius-sm)',
                          }}
                          title="Download"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => handleCopyLink(file)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: copiedId === file.id ? 'var(--success)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: 'var(--radius-sm)',
                          }}
                          title="Copy Link"
                        >
                          {copiedId === file.id ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          groupId={group.id}
          fileId={previewFile.id}
          filename={previewFile.filename}
          mimeType={previewFile.mime_type}
        />
      )}
    </div>
  );
};
