import React, { useState } from 'react';
import { Group, Message, api } from '../../services/api';
import { useGroup } from '../../context/GroupContext';
import { Avatar } from '../common/Avatar';
import { Button } from '../common/Button';
import { X, Forward, Check, AlertCircle } from 'lucide-react';

interface ForwardMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  currentGroupId: string;
  onForwardSuccess?: () => void;
}

export const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({
  isOpen,
  onClose,
  message,
  currentGroupId,
  onForwardSuccess,
}) => {
  const { groups } = useGroup();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [forwarding, setForwarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !message) return null;

  // Filter out current group: user forwards to other groups where they are a member
  const eligibleGroups = groups.filter((g) => g.id !== currentGroupId);

  const handleForward = async () => {
    if (!selectedGroupId) return;
    setForwarding(true);
    setError(null);

    try {
      await api.forwardMessage(currentGroupId, message.id, selectedGroupId);
      setSuccess(true);
      if (onForwardSuccess) onForwardSuccess();
      setTimeout(() => {
        setSuccess(false);
        setSelectedGroupId(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to forward message.');
    } finally {
      setForwarding(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
          border: '1px solid var(--border-subtle)',
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
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Forward size={18} color="var(--brand-primary)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Forward Message
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
          {/* Message Preview */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              borderLeft: '3px solid var(--brand-primary)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 500 }}>
              Original message from {message.sender_name}:
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
              {message.content}
            </div>
            {message.filename && (
              <div style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', marginTop: '4px' }}>
                📎 {message.filename}
              </div>
            )}
          </div>

          {error && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--success-bg)',
                color: 'var(--success)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Check size={14} />
              <span>Message forwarded successfully!</span>
            </div>
          )}

          {/* Destination Group Selection */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Select Destination Workspace:
            </label>

            {eligibleGroups.length === 0 ? (
              <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>
                You do not belong to any other workspaces to forward to.
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}
              >
                {eligibleGroups.map((g) => {
                  const isSelected = selectedGroupId === g.id;
                  return (
                    <div
                      key={g.id}
                      onClick={() => setSelectedGroupId(g.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        backgroundColor: isSelected ? 'var(--brand-primary-light)' : 'var(--bg-app)',
                        border: isSelected ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar name={g.name} size="sm" />
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {g.name}
                          </div>
                          {g.description && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
                              {g.description}
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          border: isSelected ? '2px solid var(--brand-primary)' : '2px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isSelected ? 'var(--brand-primary)' : 'transparent',
                        }}
                      >
                        {isSelected && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FFFFFF' }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
          <Button variant="ghost" size="sm" onClick={onClose} disabled={forwarding}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleForward}
            disabled={!selectedGroupId || forwarding || success}
            loading={forwarding}
            icon={<Forward size={14} />}
          >
            Forward
          </Button>
        </div>
      </div>
    </div>
  );
};
