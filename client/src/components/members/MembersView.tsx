import React, { useState } from 'react';
import { Avatar } from '../common/Avatar';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { DeleteGroupModal } from '../common/DeleteGroupModal';
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
  const [isDeleteGroupOpen, setIsDeleteGroupOpen] = useState(false);

  // Determine current user's role in this group
  const currentUserMembership = activeMembers.find((m) => m.id === user?.id);
  const isOwner = currentUserMembership?.role === 'owner';
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

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    setRemovingMember(true);
    setActionError(null);

    try {
      await api.removeMember(group.id, memberToRemove.id);
      refreshActiveGroupMembers();
      setMemberToRemove(null);
    } catch (err: any) {
      setActionError(err.message || 'Failed to remove member.');
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
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-sm)',
              }}
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
              Danger Zone: Delete Workspace
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Permanently delete this workspace, active calls, and associated records.
            </div>
          </div>

          <Button
            variant="danger"
            size="sm"
            onClick={() => setIsDeleteGroupOpen(true)}
            icon={<Trash2 size={14} />}
          >
            Delete Workspace
          </Button>
        </div>
      )}

      {/* Member Removal Confirmation Dialog (Feature 4.2) */}
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
          onClick={() => setMemberToRemove(null)}
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
                  Remove {memberToRemove.name} from this group?
                </h3>
              </div>
              <button
                onClick={() => setMemberToRemove(null)}
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

            <div style={{ padding: '20px', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <strong>{memberToRemove.name}</strong> will lose access to this group's messages, files, and calls.
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
              <Button variant="ghost" size="sm" onClick={() => setMemberToRemove(null)} disabled={removingMember}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmRemoveMember}
                loading={removingMember}
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
    </div>
  );
};
