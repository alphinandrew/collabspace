import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Avatar } from '../common/Avatar';
import { Users, Sparkles, AlertCircle } from 'lucide-react';
import { useGroup } from '../../context/GroupContext';
import { InvitationData, Group } from '../../services/api';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (group: Group, invitation: InvitationData) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { createGroup } = useGroup();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide a group workspace name.');
      return;
    }

    setLoading(true);
    try {
      const res = await createGroup(name.trim(), description.trim());
      setName('');
      setDescription('');
      onClose();
      onCreated(res.group, res.invitation);
    } catch (err: any) {
      setError(err.message || 'Failed to create group workspace.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Workspace Group" maxWidth="480px">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              background: 'var(--danger-bg)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger)',
              fontSize: '0.875rem',
            }}
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Live Avatar Preview */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '14px',
            background: 'var(--bg-app)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Avatar name={name || 'Collab Space'} size="lg" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {name || 'Workspace Preview'}
              </span>
              <Sparkles size={14} color="var(--brand-primary)" />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              A clean monogram avatar will be generated automatically.
            </p>
          </div>
        </div>

        <Input
          label="Workspace Group Name"
          placeholder="e.g. Engineering Core, Design Sprint, Project Titan"
          value={name}
          onChange={(e) => setName(e.target.value)}
          leftIcon={<Users size={18} />}
          required
          autoFocus
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            htmlFor="group-desc"
            style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}
          >
            Workspace Description (Optional)
          </label>
          <textarea
            id="group-desc"
            rows={3}
            placeholder="Share the mission or purpose of this workspace group..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              outline: 'none',
              resize: 'none',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            Create Group
          </Button>
        </div>
      </form>
    </Modal>
  );
};
