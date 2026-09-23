import React, { useState } from 'react';
import { Avatar } from '../common/Avatar';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Group, Member, api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useGroup } from '../../context/GroupContext';
import { Shield, ShieldCheck, UserX, MoreVertical, Crown } from 'lucide-react';

interface MembersViewProps {
  group: Group;
}

export const MembersView: React.FC<MembersViewProps> = ({ group }) => {
  const { user } = useAuth();
  const { activeMembers, refreshActiveGroupMembers } = useGroup();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const handleRemoveMember = async (memberId: string) => {
    setActionError(null);
    if (!window.confirm('Are you sure you want to remove this member from the workspace group?')) {
      return;
    }

    try {
      await api.removeMember(group.id, memberId);
      refreshActiveGroupMembers();
      setSelectedUserId(null);
    } catch (err: any) {
      setActionError(err.message || 'Failed to remove member.');
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
          const canManage = isAdmin && !isSelf && member.role !== 'owner';

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

                {/* Management Action Menu for Admins */}
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
                        {member.role === 'member' ? (
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
                        ) : (
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
                          onClick={() => handleRemoveMember(member.id)}
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
                          Remove Member
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
    </div>
  );
};
