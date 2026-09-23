import React from 'react';
import { Avatar } from '../common/Avatar';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Group, Member } from '../../services/api';
import { X, QrCode, Phone, Video, FileText } from 'lucide-react';
import { useCall } from '../../context/CallContext';

interface ContextPanelProps {
  group: Group;
  members: Member[];
  onClose: () => void;
  onOpenInvitation: () => void;
  onStartCall: (type: 'voice' | 'video') => void;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({
  group,
  members,
  onClose,
  onOpenInvitation,
  onStartCall,
}) => {
  const { callStatus } = useCall();

  return (
    <aside
      className="animate-slide-up"
      style={{
        width: '300px',
        height: '100%',
        backgroundColor: 'var(--bg-sidebar)',
        borderLeft: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflowY: 'auto',
      }}
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
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Workspace Details
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Workspace Card */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '10px' }}>
          <Avatar name={group.name} size="xl" />
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {group.name}
            </h3>
            {group.description ? (
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                {group.description}
              </p>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                No description provided.
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onStartCall('voice')}
            icon={<Phone size={15} />}
          >
            Voice Call
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onStartCall('video')}
            icon={<Video size={15} />}
          >
            Video Call
          </Button>
        </div>

        {/* Invitation & Code */}
        <div
          style={{
            padding: '14px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Group Join Code
            </span>
            <Button size="sm" variant="ghost" onClick={onOpenInvitation} icon={<QrCode size={14} />}>
              QR
            </Button>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1.1rem',
              fontWeight: 700,
              color: 'var(--brand-primary)',
              letterSpacing: '0.05em',
            }}
          >
            {group.join_code}
          </div>
        </div>

        {/* Quick Members List */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Members ({members.length})
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {members.map((member) => (
              <div
                key={member.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <Avatar name={member.name} size="sm" status={member.status} />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.825rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {member.name}
                    </div>
                  </div>
                </div>
                <Badge
                  size="sm"
                  variant={
                    member.role === 'owner'
                      ? 'primary'
                      : member.role === 'admin'
                      ? 'warning'
                      : 'neutral'
                  }
                >
                  {member.role}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
