import React from 'react';
import { Avatar } from '../common/Avatar';
import { AttachmentCard } from './AttachmentCard';
import { Message } from '../../services/api';
import { Check, CheckCheck, Clock, AlertCircle, RotateCcw } from 'lucide-react';

interface MessageItemProps {
  message: Message;
  isCurrentUser: boolean;
  groupId: string;
  onRetry?: (message: Message) => void;
  onPreviewAttachment?: (fileId: string, filename: string, mimeType?: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isCurrentUser,
  groupId,
  onRetry,
  onPreviewAttachment,
}) => {
  const formatTime = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isCurrentUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '4px 0',
        width: '100%',
      }}
    >
      {/* Avatar (for peers only to keep user side clean) */}
      {!isCurrentUser && (
        <Avatar name={message.sender_name} src={message.sender_avatar} size="sm" />
      )}

      {/* Bubble Container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isCurrentUser ? 'flex-end' : 'flex-start',
          maxWidth: '70%',
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

        {/* Message Bubble */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: isCurrentUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
            backgroundColor: isCurrentUser
              ? 'var(--brand-primary)'
              : 'var(--bg-surface-elevated)',
            color: isCurrentUser ? '#FFFFFF' : 'var(--text-primary)',
            border: isCurrentUser ? 'none' : '1px solid var(--border-subtle)',
            fontSize: '0.9rem',
            lineHeight: 1.45,
            wordBreak: 'break-word',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative',
          }}
        >
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
