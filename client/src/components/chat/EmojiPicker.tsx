import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose?: () => void;
}

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '☺️', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛',
      '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒',
      '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭',
      '😮‍💨', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰',
      '😥', '😓', '🤗', '🤔', '🫣', '🤭', '🫢', '🫡', '🤫', '🫠', '🤥', '😶',
      '😐', '😑', '😬', '🫨', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤',
    ],
  },
  {
    name: 'Gestures',
    emojis: [
      '👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '🤜', '🤛', '✊', '👊', '✌️',
      '🤞', '🫰', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️',
      '✋', '🤚', '🖐️', '🖖', '👋', '🤙', '🫱', '🫲', '🫳', '🫴', '🫵', '✍️',
      '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁',
      '👀', '👁️', '👅', '👄', '🫦',
    ],
  },
  {
    name: 'Hearts & Symbols',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️',
      '💯', '💢', '💥', '✨', '⭐', '🌟', '💫', '🔥', '⚡', '🎉', '🎊', '🎈',
      '✅', '❌', '⭕', '🛑', '⛔', '⚠️', '❗', '❓', '❕', '❔', '♻️', '❇️',
    ],
  },
  {
    name: 'Objects & Food',
    emojis: [
      '☕', '🍵', '🍕', '🍔', '🍟', '🍺', '🍻', '🥂', '🍷', '🚀', '💡', '📌',
      '📎', '📁', '📂', '📄', '💻', '📱', '📊', '📈', '🔒', '🔑', '🛡️', '⚙️',
      '🏆', '🥇', '🥈', '🥉', '🎁', '📦', '🏷️', '✉️', '📧', '🔔', '💬', '💭',
    ],
  },
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelectEmoji }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const filteredEmojis = useMemo(() => {
    if (!search.trim()) return null;
    const query = search.trim().toLowerCase();
    const all = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
    // Simple filter - since emojis are unicode, return matches
    return all.filter((e) => e.includes(query));
  }, [search]);

  return (
    <div
      className="animate-slide-up"
      style={{
        width: '320px',
        backgroundColor: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xl)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 100,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search Input */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: isSearchFocused ? '1px solid var(--border-focus)' : '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'var(--bg-surface)',
          transition: 'border-color var(--transition-fast)',
        }}
      >
        <Search size={14} color={isSearchFocused ? 'var(--brand-primary)' : 'var(--text-muted)'} />
        <input
          type="text"
          placeholder="Search emojis..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '0.825rem',
          }}
        />
      </div>

      {/* Category Tabs */}
      {!search.trim() && (
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          {EMOJI_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setActiveTab(idx)}
              style={{
                flex: 1,
                padding: '8px 4px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === idx ? '2px solid var(--brand-primary)' : '2px solid transparent',
                color: activeTab === idx ? 'var(--brand-primary)' : 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all var(--transition-fast)',
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Emoji Grid */}
      <div
        style={{
          padding: '10px',
          maxHeight: '210px',
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '6px',
        }}
      >
        {(filteredEmojis || EMOJI_CATEGORIES[activeTab].emojis).map((emoji, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelectEmoji(emoji)}
            style={{
              width: '36px',
              height: '36px',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '1.25rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.1s ease, background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
              e.currentTarget.style.transform = 'scale(1.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
