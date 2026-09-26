import React, { useState, useEffect, useRef } from 'react';
import { Avatar } from '../common/Avatar';
import { AttachmentCard } from './AttachmentCard';
import { Message } from '../../services/api';
import { EmojiPicker } from './EmojiPicker';
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  RotateCcw,
  Forward,
  Copy,
  Trash2,
  Smile,
} from 'lucide-react';

interface MessageItemProps {
  message: Message;
  isCurrentUser: boolean;
  groupId: string;
  currentUserId?: string;
  canDelete?: boolean;
  onRetry?: (message: Message) => void;
  onPreviewAttachment?: (fileId: string, filename: string, mimeType?: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onForward?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
}

// 8 Required common reaction emojis specified in Feature 1
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👎'];

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isCurrentUser,
  groupId,
  currentUserId,
  canDelete = false,
  onRetry,
  onPreviewAttachment,
  onToggleReaction,
  onForward,
  onDelete,
}) => {
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const [copied, setCopied] = useState(false);

  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMovedRef = useRef<boolean>(false);

  const formatTime = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const handleCopy = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    closeContextMenu();
  };

  const closeContextMenu = () => {
    setContextMenuPos(null);
    setShowFullPicker(false);
  };

  // Viewport-clamped positioning for context menu
  const openContextMenuAt = (clientX: number, clientY: number) => {
    const MENU_WIDTH = 250;
    const MENU_HEIGHT = 280;
    const x = Math.min(clientX, window.innerWidth - MENU_WIDTH - 12);
    const y = Math.min(clientY, window.innerHeight - MENU_HEIGHT - 12);
    setContextMenuPos({ x: Math.max(12, x), y: Math.max(12, y) });
    setShowFullPicker(false);
  };

  // Right-click context menu event handler
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenuAt(e.clientX, e.clientY);
  };

  // Keyboard accessibility: Shift+F10 or ContextMenu key opens menu at bubble
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
      e.preventDefault();
      e.stopPropagation();
      if (bubbleRef.current) {
        const rect = bubbleRef.current.getBoundingClientRect();
        openContextMenuAt(rect.left + 20, rect.top + 20);
      }
    }
  };

  // Touch device long-press handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchMovedRef.current = false;
    const touch = e.touches[0];
    if (!touch) return;
    const clientX = touch.clientX;
    const clientY = touch.clientY;

    touchTimerRef.current = setTimeout(() => {
      if (!touchMovedRef.current) {
        openContextMenuAt(clientX, clientY);
      }
    }, 500);
  };

  const handleTouchMove = () => {
    touchMovedRef.current = true;
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };

  // Close context menu on outside click or Escape key
  useEffect(() => {
    if (!contextMenuPos) return;

    const handleOutsideClick = (e: MouseEvent | PointerEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeContextMenu();
      }
    };

    window.addEventListener('pointerdown', handleOutsideClick);
    window.addEventListener('keydown', handleWindowKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handleOutsideClick);
      window.removeEventListener('keydown', handleWindowKeyDown);
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    };
  }, [contextMenuPos]);

  // Detect if message is exclusively emojis
  const isEmojiOnly =
    !message.file_id &&
    /^(\p{Extended_Pictographic}|\s)+$/u.test(message.content.trim()) &&
    message.content.trim().length <= 16;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isCurrentUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '4px 0',
        width: '100%',
        position: 'relative',
      }}
    >
      {/* Avatar (for peers only) */}
      {!isCurrentUser && (
        <Avatar name={message.sender_name} src={message.sender_avatar} size="sm" />
      )}

      {/* Bubble & Actions Container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isCurrentUser ? 'flex-end' : 'flex-start',
          maxWidth: '75%',
          position: 'relative',
        }}
      >
        {/* Sender Name & Timestamp Header */}
        {!isCurrentUser && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '3px',
              paddingLeft: '2px',
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {message.sender_name}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {formatTime(message.created_at)}
            </span>
          </div>
        )}

        {/* Message Bubble - Right-click opens context menu */}
        <div
          ref={bubbleRef}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          style={{
            padding: isEmojiOnly ? '4px 0' : '10px 14px',
            borderRadius: isCurrentUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
            backgroundColor: isEmojiOnly
              ? 'transparent'
              : isCurrentUser
              ? 'var(--brand-primary)'
              : 'var(--bg-surface-elevated)',
            color: isCurrentUser ? '#FFFFFF' : 'var(--text-primary)',
            border: isEmojiOnly ? 'none' : isCurrentUser ? 'none' : '1px solid var(--border-subtle)',
            fontSize: isEmojiOnly ? '2.2rem' : '0.9rem',
            lineHeight: isEmojiOnly ? 1.2 : 1.45,
            wordBreak: 'break-word',
            boxShadow: isEmojiOnly ? 'none' : 'var(--shadow-sm)',
            position: 'relative',
            cursor: 'default',
            outline: 'none',
          }}
        >
          {/* Forwarded Header Indicator */}
          {message.forwarded_from_sender_name && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.72rem',
                color: isCurrentUser ? 'rgba(255, 255, 255, 0.85)' : 'var(--brand-primary)',
                marginBottom: '6px',
                fontWeight: 600,
              }}
            >
              <Forward size={12} />
              <span>Forwarded from {message.forwarded_from_sender_name}</span>
            </div>
          )}

          {message.content}

          {/* Attachment Card if present */}
          {message.file_id && message.filename && (
            <AttachmentCard
              fileId={message.file_id}
              filename={message.filename}
              mimeType={message.mime_type}
              size={message.file_size}
              groupId={groupId}
              onPreview={onPreviewAttachment}
            />
          )}
        </div>

        {/* Reactions Chips Row below message */}
        {message.reactions && message.reactions.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
              marginTop: '4px',
            }}
          >
            {message.reactions.map((rxn) => {
              const hasReacted = currentUserId && rxn.userIds.includes(currentUserId);
              const namesList = rxn.users?.map((u) => u.name).join(', ') || '';

              return (
                <button
                  key={rxn.emoji}
                  type="button"
                  onClick={() => onToggleReaction && onToggleReaction(message.id, rxn.emoji)}
                  title={namesList ? `${namesList} reacted with ${rxn.emoji}` : rxn.emoji}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: hasReacted
                      ? 'var(--brand-primary-light)'
                      : 'var(--bg-surface-elevated)',
                    border: hasReacted
                      ? '1px solid var(--brand-primary)'
                      : '1px solid var(--border-subtle)',
                    color: hasReacted ? 'var(--brand-primary)' : 'var(--text-secondary)',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <span>{rxn.emoji}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>{rxn.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Status indicator & Time for current user */}
        {isCurrentUser && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '3px',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>{formatTime(message.created_at)}</span>
            {message.status === 'sending' && <Clock size={12} color="var(--text-muted)" />}
            {message.status === 'sent' && <Check size={12} color="var(--brand-primary)" />}
            {message.status === 'failed' && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: 'var(--danger)',
                  cursor: 'pointer',
                }}
                onClick={() => onRetry && onRetry(message)}
              >
                <AlertCircle size={12} />
                Failed <RotateCcw size={10} />
              </span>
            )}
            {!message.status && <CheckCheck size={12} color="var(--brand-primary)" />}
          </div>
        )}
      </div>

      {/* Desktop-Style Right-Click Context Menu */}
      {contextMenuPos && (
        <div
          ref={contextMenuRef}
          className="animate-slide-up"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: `${contextMenuPos.x}px`,
            top: `${contextMenuPos.y}px`,
            width: '240px',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xl)',
            padding: '8px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            backdropFilter: 'blur(8px)',
          }}
        >
          {/* Reaction Picker Section */}
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                padding: '4px 6px 6px 6px',
                letterSpacing: '0.04em',
              }}
            >
              React to Message
            </div>

            {/* Common Reactions Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '4px',
                padding: '2px',
              }}
            >
              {REACTION_EMOJIS.map((emoji) => {
                const isReacted =
                  currentUserId &&
                  message.reactions?.some(
                    (r) => r.emoji === emoji && r.userIds.includes(currentUserId)
                  );

                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      if (onToggleReaction) onToggleReaction(message.id, emoji);
                      closeContextMenu();
                    }}
                    style={{
                      background: isReacted ? 'var(--brand-primary-light)' : 'transparent',
                      border: isReacted
                        ? '1px solid var(--brand-primary)'
                        : '1px solid transparent',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px',
                      fontSize: '1.15rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 0.1s ease, background 0.15s ease',
                    }}
                    title={`React ${emoji}`}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.2)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.backgroundColor = isReacted
                        ? 'var(--brand-primary-light)'
                        : 'transparent';
                    }}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>

            {/* More Reactions / Emoji Picker Toggle */}
            {onToggleReaction && (
              <button
                type="button"
                onClick={() => setShowFullPicker(!showFullPicker)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '6px',
                  marginTop: '4px',
                  background: 'transparent',
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                <Smile size={13} />
                <span>{showFullPicker ? 'Hide Emojis' : 'More Reactions...'}</span>
              </button>
            )}

            {/* Extended Emoji Picker Submenu */}
            {showFullPicker && onToggleReaction && (
              <div style={{ marginTop: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                <EmojiPicker
                  onSelectEmoji={(emoji) => {
                    onToggleReaction(message.id, emoji);
                    closeContextMenu();
                  }}
                />
              </div>
            )}
          </div>

          <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '2px 0' }} />

          {/* Action List Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* Copy Message Text */}
            <button
              type="button"
              onClick={() => handleCopy()}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 8px',
                background: 'transparent',
                border: 'none',
                color: copied ? 'var(--success)' : 'var(--text-primary)',
                fontSize: '0.825rem',
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied to clipboard' : 'Copy Text'}</span>
            </button>

            {/* Forward Message */}
            {onForward && (
              <button
                type="button"
                onClick={() => {
                  onForward(message);
                  closeContextMenu();
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 8px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Forward size={14} />
                <span>Forward Message</span>
              </button>
            )}

            {/* Delete Message (Author or Admin/Owner) */}
            {(isCurrentUser || canDelete) && onDelete && (
              <button
                type="button"
                onClick={() => {
                  closeContextMenu();
                  if (window.confirm('Are you sure you want to delete this message?')) {
                    onDelete(message.id);
                  }
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 8px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--danger)',
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--danger-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Trash2 size={14} />
                <span>Delete Message</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
