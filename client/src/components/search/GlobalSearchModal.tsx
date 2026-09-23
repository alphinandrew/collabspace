import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Avatar } from '../common/Avatar';
import { api, Message, FileItem, Group } from '../../services/api';
import { Search, MessageSquare, FileText, Users, Loader2 } from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGroup?: (groupId: string) => void;
  onPreviewFile?: (fileId: string, filename: string, mimeType?: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectGroup,
  onPreviewFile,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    messages: (Message & { group_name?: string })[];
    files: (FileItem & { group_name?: string })[];
    groups: Group[];
  } | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await api.searchGlobal(query.trim());
      setResults(res);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Global Workspace Search" maxWidth="640px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Search Input Bar */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <Search size={18} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search across all messages, files, and workspaces..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
              }}
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            style={{
              padding: '0 18px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--brand-primary)',
              border: 'none',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
          </button>
        </form>

        {/* Results Container */}
        <div style={{ maxHeight: '55vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {results && (
            <>
              {/* Messages section */}
              {results.messages.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Messages ({results.messages.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {results.messages.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          padding: '10px 12px',
                          backgroundColor: 'var(--bg-app)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          if (onSelectGroup) onSelectGroup(m.group_id);
                          onClose();
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--brand-primary)' }}>
                            #{m.group_name || 'Workspace'}
                          </span>
                          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                            {m.sender_name}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{m.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files section */}
              {results.files.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Files ({results.files.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {results.files.map((f) => (
                      <div
                        key={f.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          backgroundColor: 'var(--bg-app)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          if (onPreviewFile) onPreviewFile(f.id, f.filename, f.mime_type);
                          onClose();
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <FileText size={18} color="var(--brand-primary)" />
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{f.filename}</div>
                            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                              #{f.group_name} • By {f.uploader_name}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Workspaces section */}
              {results.groups.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Workspaces ({results.groups.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {results.groups.map((g) => (
                      <div
                        key={g.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          backgroundColor: 'var(--bg-app)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          if (onSelectGroup) onSelectGroup(g.id);
                          onClose();
                        }}
                      >
                        <Avatar name={g.name} size="sm" />
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{g.name}</div>
                          <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                            Code: {g.join_code}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.messages.length === 0 && results.files.length === 0 && results.groups.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No matching messages, files, or workspaces found for "{query}".
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
