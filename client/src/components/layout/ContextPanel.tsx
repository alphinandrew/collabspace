import React, { useState } from 'react';
import { Avatar } from '../common/Avatar';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { DeleteGroupModal } from '../common/DeleteGroupModal';
import { MemberContextMenu } from '../common/MemberContextMenu';
import { Group, Member, api } from '../../services/api';
import { X, QrCode, Phone, Video, Trash2, UserX } from 'lucide-react';
import { useCall } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import { useGroup } from '../../context/GroupContext';

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
  const { user } = useAuth();
  const { refreshActiveGroupMembers } = useGroup();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [memberContextMenu, setMemberContextMenu] = useState<{
    x: number;
    y: number;
    member: Member;
  } | null>(null);

  const currentUserMembership = members.find((m) => m.id === user?.id);
  const isOwner = group.owner_id === user?.id || currentUserMembership?.role === 'owner';
  const isAdmin = isOwner || currentUserMembership?.role === 'admin';

  const handleMakeAdmin = async (userId: string) => {
    await api.updateMemberRole(group.id, userId, 'admin');
    await refreshActiveGroupMembers();
  };

  const handleDemoteMember = async (userId: string) => {
    await api.updateMemberRole(group.id, userId, 'member');
    await refreshActiveGroupMembers();
  };

  const handleMemberContextMenu = (e: React.MouseEvent, member: Member) => {
    e.preventDefault();
    e.stopPropagation();
    setMemberContextMenu({
      x: e.clientX,
      y: e.clientY,
      member,
    });
  };

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove) return;
    setRemovingMember(true);
    setRemoveError(null);
    try {
      await api.removeMember(group.id, memberToRemove.id);
      await refreshActiveGroupMembers();
      setMemberToRemove(null);
    } catch (err: any) {
      setRemoveError(err.message || 'Failed to remove member.');
    } finally {
      setRemovingMember(false);
    }
  };

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
            {members.map((member) => {
              const isSelf = member.id === user?.id;
              const canKick =
                !isSelf &&
                member.role !== 'owner' &&
                (isOwner || (isAdmin && member.role === 'member'));

              return (
                <div
                  key={member.id}
                  onContextMenu={(e) => handleMemberContextMenu(e, member)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-surface)',
                    cursor: 'context-menu',
                    transition: 'background-color var(--transition-fast)',
                  }}
                  title="Right-click to manage member or make admin"
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Badge
                      size="sm"
                      variant={
                        member.role === 'owner'
                          ? 'primary'
                          : member.role === 'admin'
                          ? 'cyan'
                          : 'neutral'
                      }
                    >
                      {member.role}
                    </Badge>
                    {canKick && (
                      <button
                        onClick={() => {
                          setRemoveError(null);
                          setMemberToRemove(member);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '3px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title={`Remove ${member.name} from group`}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        <UserX size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Danger Zone: Delete Group for Admin/Owner */}
        {isAdmin && (
          <div style={{ marginTop: '10px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <Button
              variant="danger"
              size="sm"
              style={{ width: '100%' }}
              onClick={() => setIsDeleteOpen(true)}
              icon={<Trash2 size={14} />}
            >
              Delete Group
            </Button>
          </div>
        )}
      </div>

      {/* Member Removal Confirmation Dialog */}
      {memberToRemove && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => {
            if (!removingMember) setMemberToRemove(null);
          }}
        >
          <div
            className="animate-slide-up"
            style={{
              width: '100%',
              maxWidth: '440px',
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
                <UserX size={18} color="var(--danger)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Remove {memberToRemove.name} from group?
                </h3>
              </div>
              <button
                onClick={() => {
                  if (!removingMember) setMemberToRemove(null);
                }}
                disabled={removingMember}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: removingMember ? 'not-allowed' : 'pointer',
                  padding: '4px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to remove <strong>{memberToRemove.name}</strong> from <strong>{group.name}</strong>? They will lose access to all messages, files, and calls in this workspace.
              </p>

              {removeError && (
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: 'var(--danger-bg)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: 'var(--danger)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.85rem',
                  }}
                >
                  {removeError}
                </div>
              )}
            </div>

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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMemberToRemove(null)}
                disabled={removingMember}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmRemoveMember}
                loading={removingMember}
                disabled={removingMember}
              >
                Remove Member
              </Button>
            </div>
          </div>
        </div>
      )}

      <DeleteGroupModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        group={group}
      />

      {memberContextMenu && (
        <MemberContextMenu
          x={memberContextMenu.x}
          y={memberContextMenu.y}
          member={memberContextMenu.member}
          isOwner={isOwner}
          isAdmin={isAdmin}
          isSelf={memberContextMenu.member.id === user?.id}
          onMakeAdmin={handleMakeAdmin}
          onDemoteMember={handleDemoteMember}
          onRemoveMember={(m) => {
            setRemoveError(null);
            setMemberToRemove(m);
          }}
          onClose={() => setMemberContextMenu(null)}
        />
      )}
    </aside>
  );
};
