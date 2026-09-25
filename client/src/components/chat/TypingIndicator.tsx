import React from 'react';
import { Avatar } from '../common/Avatar';

export interface TypingUserInfo {
  userId: string;
  userName: string;
  userAvatar?: string;
  lastActive: number;
}

interface TypingIndicatorProps {
  users: TypingUserInfo[];
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ users }) => {
  if (!users || users.length === 0) return null;

  // Render descriptive text
  const getTypingText = () => {
    if (users.length === 1) {
      return (
        <span>
          <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {users[0].userName}
          </strong>{' '}
          is typing...
        </span>
      );
    }
    if (users.length === 2) {
      return (
        <span>
          <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {users[0].userName}
          </strong>{' '}
          and{' '}
          <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {users[1].userName}
          </strong>{' '}
          are typing...
        </span>
      );
    }
    return (
      <span>
        <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          {users[0].userName}
        </strong>{' '}
        and {users.length - 1} others are typing...
      </span>
    );
  };

  return (
    <div
      className="typing-indicator-pill"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '9px',
        padding: '6px 14px 6px 10px',
        backgroundColor: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-highlight)',
        borderRadius: '16px',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25), 0 0 10px rgba(99, 102, 241, 0.1)',
        backdropFilter: 'blur(10px)',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)',
        margin: '4px 0 8px 12px',
        maxWidth: 'fit-content',
        userSelect: 'none',
        transition: 'all 0.2s ease-out',
      }}
    >
      {/* Avatars */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {users.slice(0, 3).map((u, i) => (
          <div
            key={u.userId}
            style={{
              marginLeft: i > 0 ? '-8px' : '0',
              zIndex: 3 - i,
              borderRadius: '50%',
              boxShadow: '0 0 0 2px var(--bg-surface-elevated)',
            }}
          >
            <Avatar name={u.userName} src={u.userAvatar} size="sm" style={{ width: '22px', height: '22px' }} />
          </div>
        ))}
      </div>

      {/* Animated 3-Dot Wave */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 4px',
          height: '14px',
        }}
        aria-hidden="true"
      >
        <span className="typing-dot dot-1" />
        <span className="typing-dot dot-2" />
        <span className="typing-dot dot-3" />
      </div>

      {/* Label */}
      <div style={{ whiteSpace: 'nowrap' }}>{getTypingText()}</div>
    </div>
  );
};
