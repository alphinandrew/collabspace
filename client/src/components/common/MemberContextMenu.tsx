import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { ShieldCheck, Shield, UserX, Crown, AlertCircle, Loader2 } from 'lucide-react';
import { Member } from '../../services/api';

export interface MemberContextMenuProps {
  x: number;
  y: number;
  member: Member | { id: string; name: string; email?: string; role?: string; avatar?: string | null };
  isOwner: boolean;
  isAdmin: boolean;
  isSelf: boolean;
  onMakeAdmin: (userId: string) => Promise<void>;
  onDemoteMember?: (userId: string) => Promise<void>;
  onRemoveMember?: (member: any) => void;
  onClose: () => void;
}

export const MemberContextMenu: React.FC<MemberContextMenuProps> = ({
  x,
  y,
  member,
  isOwner,
  isAdmin,
  isSelf,
  onMakeAdmin,
  onDemoteMember,
  onRemoveMember,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MENU_WIDTH = 260;
  const MENU_HEIGHT = 280;

  // Clamp coordinates within the viewport
  const clampedX = Math.min(Math.max(12, x), window.innerWidth - MENU_WIDTH - 12);
  const clampedY = Math.min(Math.max(12, y), window.innerHeight - MENU_HEIGHT - 12);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleScrollOrResize = () => {
      onClose();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [onClose]);

  const handlePromote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    setLoading(true);
    try {
      await onMakeAdmin(member.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to promote member.');
      setLoading(false);
    }
  };

  const handleDemote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDemoteMember) return;
    setError(null);
    setLoading(true);
    try {
      await onDemoteMember(member.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to demote member.');
      setLoading(false);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onRemoveMember) return;
    onClose();
    onRemoveMember(member);
  };

  const isTargetOwner = member.role === 'owner';
  const isTargetAdmin = member.role === 'admin';
  const canPromoteToAdmin = !isSelf && !isTargetOwner && !isTargetAdmin && (isOwner || isAdmin);
  const canDemoteToMember = !isSelf && !isTargetOwner && isTargetAdmin && isOwner;
  const canRemove = !isSelf && !isTargetOwner && (isOwner || (isAdmin && !isTargetAdmin)) && !!onRemoveMember;

  const content = (
    <div
      ref={menuRef}
      className="animate-slide-up"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        position: 'fixed',
        left: `${clampedX}px`,
        top: `${clampedY}px`,
        width: `${MENU_WIDTH}px`,
        backgroundColor: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xl)',
        padding: '10px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        backdropFilter: 'blur(12px)',
        userSelect: 'none',
      }}
    >
      {/* Target Member Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '4px 6px 8px 6px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <Avatar name={member.name} src={(member as any).avatar} size="sm" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {member.name} {isSelf && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(You)</span>}
          </div>
          {member.email && (
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {member.email}
            </div>
          )}
        </div>
        <Badge
          size="sm"
          variant={isTargetOwner ? 'primary' : isTargetAdmin ? 'cyan' : 'neutral'}
        >
          {isTargetOwner ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <Crown size={11} /> Owner
            </span>
          ) : isTargetAdmin ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <ShieldCheck size={11} /> Admin
            </span>
          ) : (
            'Member'
          )}
        </Badge>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            padding: '6px 8px',
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--danger)',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Action items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* Make Admin Option */}
        {canPromoteToAdmin && (
          <button
            type="button"
            disabled={loading}
            onClick={handlePromote}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'background-color var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" color="var(--brand-primary)" />
            ) : (
              <ShieldCheck size={16} color="var(--accent-cyan)" />
            )}
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Make Admin</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Grant workspace administrator privileges
              </div>
            </div>
          </button>
        )}

        {/* Demote to Member Option */}
        {canDemoteToMember && (
          <button
            type="button"
            disabled={loading}
            onClick={handleDemote}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'background-color var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" color="var(--brand-primary)" />
            ) : (
              <Shield size={16} color="var(--text-secondary)" />
            )}
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Demote to Member</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Remove administrator privileges
              </div>
            </div>
          </button>
        )}

        {/* Informational states when no role modification can be made */}
        {isTargetAdmin && !isOwner && !isSelf && (
          <div
            style={{
              padding: '8px 10px',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
            }}
          >
            Administrator privileges can only be modified by the workspace owner.
          </div>
        )}

        {isTargetOwner && !isSelf && (
          <div
            style={{
              padding: '8px 10px',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
            }}
          >
            Workspace Owner role cannot be modified.
          </div>
        )}

        {isSelf && (
          <div
            style={{
              padding: '8px 10px',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
            }}
          >
            You cannot change your own role.
          </div>
        )}

        {/* Remove Member Option */}
        {canRemove && (
          <>
            <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />
            <button
              type="button"
              disabled={loading}
              onClick={handleRemove}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--danger)',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'background-color var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--danger-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <UserX size={16} color="var(--danger)" />
              <div>
                <div style={{ fontWeight: 600 }}>Remove from Workspace</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Revoke membership from this group
                </div>
              </div>
            </button>
          </>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
};
