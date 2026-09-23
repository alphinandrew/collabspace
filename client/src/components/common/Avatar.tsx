import React from 'react';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: string; // 'online' | 'offline' | 'away'
  style?: React.CSSProperties;
}

const colorPairs = [
  ['#4F46E5', '#7C3AED'],
  ['#2563EB', '#0284C7'],
  ['#059669', '#10B981'],
  ['#D97706', '#F59E0B'],
  ['#DC2626', '#E11D48'],
  ['#7C3AED', '#C026D3'],
];

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colorPairs.length;
  const [c1, c2] = colorPairs[index];
  return `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 'md',
  status,
  style,
}) => {
  const getDims = () => {
    switch (size) {
      case 'sm':
        return { px: 28, font: '0.75rem', dot: 8 };
      case 'lg':
        return { px: 48, font: '1.15rem', dot: 12 };
      case 'xl':
        return { px: 64, font: '1.5rem', dot: 16 };
      case 'md':
      default:
        return { px: 36, font: '0.875rem', dot: 10 };
    }
  };

  const { px, font, dot } = getDims();

  return (
    <div
      style={{
        position: 'relative',
        width: `${px}px`,
        height: `${px}px`,
        flexShrink: 0,
        ...style,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: src ? 'var(--bg-surface)' : getGradient(name),
          color: '#FFFFFF',
          fontWeight: 600,
          fontSize: font,
          userSelect: 'none',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        {src ? (
          <img
            src={src}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          getInitials(name)
        )}
      </div>
      {status && (
        <span
          style={{
            position: 'absolute',
            bottom: '0',
            right: '0',
            width: `${dot}px`,
            height: `${dot}px`,
            borderRadius: '50%',
            backgroundColor:
              status === 'online'
                ? 'var(--status-online)'
                : status === 'busy'
                ? 'var(--status-busy)'
                : 'var(--status-offline)',
            border: '2px solid var(--bg-surface)',
          }}
        />
      )}
    </div>
  );
};
