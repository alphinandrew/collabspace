import React, { useState } from 'react';
import { Avatar } from '../common/Avatar';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { DeleteGroupModal } from '../common/DeleteGroupModal';
import { MemberContextMenu } from '../common/MemberContextMenu';
import { Group, Member, api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useGroup } from '../../context/GroupContext';
import { Shield, ShieldCheck, UserX, MoreVertical, Crown, Trash2, X } from 'lucide-react';

interface MembersViewProps {
  group: Group;
}

export const MembersView: React.FC<MembersViewProps> = ({ group }) => {
  const { user } = useAuth();
  const { activeMembers, refreshActiveGroupMembers } = useGroup();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [removeModalError, setRemoveModalError] = useState<string | null>(null);
  const [isDeleteGroupOpen, setIsDeleteGroupOpen] = useState(false);
  const [memberContextMenu, setMemberContextMenu] = useState<{
    x: number;
    y: number;
    member: Member;
  } | null>(null);

  // Determine current user's role in this group
  const currentUserMembership = activeMembers.find((m) => m.id === user?.id);
  const isOwner = group.owner_id === user?.id || currentUserMembership?.role === 'owner';
  const isAdmin = isOwner || currentUserMembership?.role === 'admin';

  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'member') => {
    setActionError(null);
    try {
      await api.updateMemberRole(group.id, memberId, newRole);
      refreshActiveGroupMembers();
      setSelectedUserId(null);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update member role.');
    }
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

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    setRemovingMember(true);
    setRemoveModalError(null);
    setActionError(null);

    try {
      await api.removeMember(group.id, memberToRemove.id);
      await refreshActiveGroupMembers();
      setMemberToRemove(null);
    } catch (err: any) {
      setRemoveModalError(err.message || 'Failed to remove member.');
    } finally {
      setRemovingMember(false);
    }
  };

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
      {/* Header */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Workspace Members
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {activeMembers.length} {activeMembers.length === 1 ? 'member' : 'members'} in #{group.name}
          </p>
        </div>
      </div>

      {actionError && (
        <div
          style={{
            margin: '16px 24px 0 24px',
            padding: '10px 14px',
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            fontSize: '0.85rem',
          }}
        >
          {actionError}
        </div>
      )}

      {/* Members List */}
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {activeMembers.map((member) => {
          const isSelf = member.id === user?.id;
          // Owner can remove admins and members. Admin can only remove normal members.
          const canManage =
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
                padding: '14px 18px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'context-menu',
                transition: 'border-color var(--transition-fast), background-color var(--transition-fast)',
              }}
              title="Right-click to manage member or make admin"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <Avatar name={member.name} src={member.avatar} size="md" status={member.status} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {member.name}
                    </span>
                    {isSelf && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(You)</span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {member.email}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <Badge
                  variant={
                    member.role === 'owner'
                      ? 'primary'
                      : member.role === 'admin'
                      ? 'warning'
                      : 'neutral'
                  }
                >
                  {member.role === 'owner' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Crown size={12} /> Owner
                    </span>
                  ) : member.role === 'admin' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldCheck size={12} /> Admin
                    </span>
                  ) : (
                    'Member'
                  )}
                </Badge>

                {/* Management Action Menu */}
                {canManage && (
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() =>
                        setSelectedUserId(selectedUserId === member.id ? null : member.id)
                      }
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <MoreVertical size={16} />
                    </button>

                    {selectedUserId === member.id && (
                      <div
                        className="animate-slide-up"
                        style={{
                          position: 'absolute',
                          top: '30px',
                          right: '0',
                          width: '180px',
                          backgroundColor: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          boxShadow: 'var(--shadow-lg)',
                          padding: '6px',
                          zIndex: 100,
                        }}
                      >
                        {isOwner && member.role === 'member' && (
                          <button
                            onClick={() => handleRoleChange(member.id, 'admin')}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-primary)',
                              fontSize: '0.825rem',
                              cursor: 'pointer',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            <Shield size={14} color="var(--warning)" />
                            Promote to Admin
                          </button>
                        )}

                        {isOwner && member.role === 'admin' && (
                          <button
                            onClick={() => handleRoleChange(member.id, 'member')}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-primary)',
                              fontSize: '0.825rem',
                              cursor: 'pointer',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            <Shield size={14} />
                            Demote to Member
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setMemberToRemove(member);
                            setSelectedUserId(null);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--danger)',
                            fontSize: '0.825rem',
                            cursor: 'pointer',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          <UserX size={14} />
                          Remove from group
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Danger Zone: Delete Group (Feature 5) */}
      {isAdmin && (
        <div
          style={{
            marginTop: 'auto',
            margin: '24px',
            padding: '20px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--danger)' }}>
              Danger Zone: Delete Group
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Permanently delete this group, active calls, and associated records.
            </div>
          </div>

          <Button
            variant="danger"
            size="sm"
            onClick={() => setIsDeleteGroupOpen(true)}
            icon={<Trash2 size={14} />}
          >
            Delete Group
          </Button>
        </div>
      )}

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

              {removeModalError && (
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
                  {removeModalError}
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
                onClick={confirmRemoveMember}
                loading={removingMember}
                disabled={removingMember}
              >
                Remove Member
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Modal (Feature 5) */}
      <DeleteGroupModal
        isOpen={isDeleteGroupOpen}
        onClose={() => setIsDeleteGroupOpen(false)}
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
          onMakeAdmin={(userId) => handleRoleChange(userId, 'admin')}
          onDemoteMember={(userId) => handleRoleChange(userId, 'member')}
          onRemoveMember={(m) => {
            setActionError(null);
            setRemoveModalError(null);
            setMemberToRemove(m);
          }}
          onClose={() => setMemberContextMenu(null)}
        />
      )}
    </div>
  );
};
