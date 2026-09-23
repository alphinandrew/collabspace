import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Avatar } from '../common/Avatar';
import { MessageItem } from './MessageItem';
import { ChatInput } from './ChatInput';
import { Group, Message, Member, api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Phone, Video, Info, MessageSquare, AlertCircle } from 'lucide-react';

interface ChatViewProps {
  group: Group;
  members: Member[];
  onStartCall: (type: 'voice' | 'video') => void;
  onToggleInfo: () => void;
  onPreviewAttachment?: (fileId: string, filename: string, mimeType?: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  group,
  members,
  onStartCall,
  onToggleInfo,
  onPreviewAttachment,
}) => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isScrolledToBottomRef = useRef(true);

  // Load message history from persistent backend database
  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMessages(group.id, 100);
      setMessages(res.messages);
    } catch (err: any) {
      setError(err.message || 'Unable to load message history.');
    } finally {
      setLoading(false);
    }
  }, [group.id]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Handle auto-scroll
  const scrollToBottom = () => {
    if (isScrolledToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    isScrolledToBottomRef.current = scrollHeight - scrollTop - clientHeight < 60;
  };

  // Real-time socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleIncomingMessage = (newMsg: Message) => {
      if (newMsg.group_id === group.id) {
        setMessages((prev) => {
          // Avoid duplicate messages
          const exists = prev.some((m) => m.id === newMsg.id);
          if (exists) return prev;
          return [...prev, newMsg];
        });
      }
    };

    const handleTyping = ({ groupId, userName, isTyping }: any) => {
      if (groupId === group.id) {
        setTypingUsers((prev) => {
          if (isTyping) {
            if (!prev.includes(userName)) return [...prev, userName];
            return prev;
          } else {
            return prev.filter((u) => u !== userName);
          }
        });
      }
    };

    socket.on('chat:message', handleIncomingMessage);
    socket.on('chat:typing', handleTyping);

    return () => {
      socket.off('chat:message', handleIncomingMessage);
      socket.off('chat:typing', handleTyping);
    };
  }, [socket, group.id]);

  const handleSendMessage = async (content: string) => {
    if (!user) return;

    // Optimistic message representation
    const tempId = 'temp_' + Date.now();
    const optimisticMsg: Message = {
      id: tempId,
      group_id: group.id,
      sender_id: user.id,
      sender_name: user.name,
      sender_avatar: user.avatar,
      content,
      message_type: 'text',
      created_at: new Date().toISOString(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await api.sendMessage(group.id, content);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...res.message, status: 'sent' } : m))
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
      );
      throw err;
    }
  };

  const handleRetryMessage = async (failedMsg: Message) => {
    try {
      const res = await api.sendMessage(group.id, failedMsg.content);
      setMessages((prev) =>
        prev.map((m) => (m.id === failedMsg.id ? { ...res.message, status: 'sent' } : m))
      );
    } catch (err) {
      console.error('Retry failed:', err);
    }
  };

  // Compute online members count
  const onlineCount = members.filter((m) => m.status === 'online').length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-app)',
        position: 'relative',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '12px 20px',
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Avatar name={group.name} size="md" />
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {group.name}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: onlineCount > 0 ? 'var(--status-online)' : 'var(--status-offline)',
                }}
              />
              <span>
                {members.length} {members.length === 1 ? 'member' : 'members'}
                {onlineCount > 0 ? ` (${onlineCount} online)` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => onStartCall('voice')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            title="Start Voice Call"
          >
            <Phone size={16} />
          </button>

          <button
            onClick={() => onStartCall('video')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--brand-primary-light)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: 'var(--brand-primary)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            title="Start Video Call"
          >
            <Video size={16} />
          </button>

          <button
            onClick={onToggleInfo}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            title="Workspace Details"
          >
            <Info size={16} />
          </button>
        </div>
      </header>

      {/* Disconnected / Reconnecting Alert */}
      {!isConnected && (
        <div
          style={{
            padding: '6px 16px',
            backgroundColor: 'var(--warning-bg)',
            color: 'var(--warning)',
            fontSize: '0.8rem',
            textAlign: 'center',
            borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
          }}
        >
          Realtime connection paused. Attempting reconnection...
        </div>
      )}

      {/* Message History List */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 0' }}>
            <div className="skeleton" style={{ width: '40%', height: '38px', borderRadius: '12px' }} />
            <div className="skeleton" style={{ width: '55%', height: '48px', alignSelf: 'flex-end', borderRadius: '12px' }} />
            <div className="skeleton" style={{ width: '35%', height: '36px', borderRadius: '12px' }} />
          </div>
        ) : error ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              flexDirection: 'column',
              gap: '12px',
              color: 'var(--danger)',
            }}
          >
            <AlertCircle size={32} />
            <p>{error}</p>
            <button
              onClick={loadMessages}
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              gap: '12px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare size={24} color="var(--brand-primary)" />
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
                Start the conversation
              </p>
              <p style={{ fontSize: '0.825rem', maxWidth: '320px', marginTop: '4px' }}>
                This is the beginning of the #{group.name} workspace. Send a message or share documents with your team.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              isCurrentUser={msg.sender_id === user?.id}
              groupId={group.id}
              onRetry={handleRetryMessage}
              onPreviewAttachment={onPreviewAttachment}
            />
          ))
        )}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '44px' }}>
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <ChatInput
        groupId={group.id}
        onSendMessage={handleSendMessage}
        onFileUploaded={loadMessages}
      />
    </div>
  );
};
