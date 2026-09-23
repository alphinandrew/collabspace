import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
}) => {
  const getStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: 'var(--brand-primary-light)',
          color: 'var(--brand-primary)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
        };
      case 'success':
        return {
          background: 'var(--success-bg)',
          color: 'var(--success)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
        };
      case 'warning':
        return {
          background: 'var(--warning-bg)',
          color: 'var(--warning)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
        };
      case 'danger':
        return {
          background: 'var(--danger-bg)',
          color: 'var(--danger)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
        };
      case 'neutral':
      default:
        return {
          background: 'var(--bg-surface-elevated)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-subtle)',
        };
    }
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        borderRadius: 'var(--radius-sm)',
        fontSize: size === 'sm' ? '0.7rem' : '0.775rem',
        padding: size === 'sm' ? '2px 6px' : '3px 8px',
        ...getStyles(),
      }}
    >
      {children}
    </span>
  );
};
