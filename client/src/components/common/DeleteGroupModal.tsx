import React, { useState } from 'react';
import { Group, api } from '../../services/api';
import { useGroup } from '../../context/GroupContext';
import { Button } from './Button';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
}

export const DeleteGroupModal: React.FC<DeleteGroupModalProps> = ({
  isOpen,
  onClose,
  group,
}) => {
  const { refreshGroups } = useGroup();
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isMatched = confirmName.trim().toLowerCase() === group.name.trim().toLowerCase();

  const handleDelete = async () => {
    if (!isMatched) return;
    setDeleting(true);
    setError(null);

    try {
      await api.deleteGroup(group.id, confirmName.trim());
      localStorage.removeItem('collabspace_last_active_group');
      await refreshGroups();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete workspace.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="animate-slide-up"
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--danger-bg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} color="var(--danger)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--danger)' }}>
              Delete this group?
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            This will remove the group and its access to messages, members, calls, and shared files
            according to the group's deletion policy. This action may be irreversible.
          </p>

          {error && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
              }}
            >
              {error}
            </div>
          )}

          <div>
            <label
              style={{
                fontSize: '0.825rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              Type <strong style={{ color: 'var(--danger)' }}>{group.name}</strong> to confirm:
            </label>
            <input
              type="text"
              placeholder={group.name}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'var(--bg-app)',
                border: isMatched ? '1px solid var(--danger)' : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            backgroundColor: 'var(--bg-surface-elevated)',
          }}
        >
          <Button variant="ghost" size="sm" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            disabled={!isMatched || deleting}
            loading={deleting}
          >
            Delete Group
          </Button>
        </div>
      </div>
    </div>
  );
};
