import React, { useState } from 'react';
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

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥'];

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
  const [isHovered, setIsHovered] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const [copied, setCopied] = useState(false);

  const formatTime = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Detect if message is exclusively emojis
  const isEmojiOnly =
    !message.file_id &&
    /^(\p{Extended_Pictographic}|\s)+$/u.test(message.content.trim()) &&
    message.content.trim().length <= 16;

  const showActions = isHovered || showFullPicker;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowFullPicker(false);
      }}
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

        {/* Unified Message Action Toolbar (Hover State) */}
        {showActions && message.status !== 'sending' && (
          <div
            className="animate-slide-up"
            style={{
              position: 'absolute',
              top: '-34px',
              [isCurrentUser ? 'right' : 'left']: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              padding: '3px 8px',
              boxShadow: 'var(--shadow-md)',
              zIndex: 30,
            }}
          >
            {/* Quick Reactions Bar */}
            {onToggleReaction && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleReaction(message.id, emoji);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      transition: 'transform 0.1s ease',
                    }}
                    title={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}

                {/* More Emojis Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFullPicker(!showFullPicker);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '3px 5px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="More reactions"
                >
                  <Smile size={14} />
                </button>
              </div>
            )}

            <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-subtle)' }} />

            {/* Forward Message Button */}
            {onForward && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onForward(message);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Forward message"
              >
                <Forward size={14} />
              </button>
            )}

            {/* Copy Content Button */}
            <button
              type="button"
              onClick={handleCopy}
              style={{
                background: 'transparent',
                border: 'none',
                color: copied ? 'var(--success)' : 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              title={copied ? 'Copied!' : 'Copy text'}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>

            {/* Delete Message Button */}
            {(isCurrentUser || canDelete) && onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('Delete this message?')) {
                    onDelete(message.id);
                  }
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--danger)',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Delete message"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}

        {/* Full Emoji Picker Popover for Reaction */}
        {showFullPicker && onToggleReaction && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              [isCurrentUser ? 'right' : 'left']: 0,
              zIndex: 100,
            }}
          >
            <EmojiPicker
              onSelectEmoji={(emoji) => {
                onToggleReaction(message.id, emoji);
                setShowFullPicker(false);
              }}
            />
          </div>
        )}

        {/* Message Bubble */}
        <div
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

        {/* Reactions Chips Row */}
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
    </div>
  );
};
