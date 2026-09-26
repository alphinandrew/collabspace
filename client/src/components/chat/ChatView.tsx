import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Avatar } from '../common/Avatar';
import { MessageItem } from './MessageItem';
import { ChatInput } from './ChatInput';
import { TypingIndicator, TypingUserInfo } from './TypingIndicator';
import { ForwardMessageModal } from './ForwardMessageModal';
import { Group, Message, Member, api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useCall } from '../../context/CallContext';
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
  const { joinCall, callStatus } = useCall();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUserInfo[]>([]);
  const [activeCallInfo, setActiveCallInfo] = useState<any | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [reactionError, setReactionError] = useState<{ messageId: string; emoji: string; error: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isScrolledToBottomRef = useRef(true);

  // Check user permission in this group
  const currentUserMembership = members.find((m) => m.id === user?.id);
  const isAdminOrOwner =
    currentUserMembership?.role === 'owner' || currentUserMembership?.role === 'admin';

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

  // Check if this group has an active call right now
  const checkActiveCall = useCallback(async () => {
    try {
      const res = await api.getActiveCall(group.id);
      if (res.call && res.call.active) {
        setActiveCallInfo(res.call);
      } else {
        setActiveCallInfo(null);
      }
    } catch (err) {
      // Ignore
    }
  }, [group.id]);

  useEffect(() => {
    checkActiveCall();
  }, [checkActiveCall]);

  // Handle auto-scroll
  const scrollToBottom = () => {
    if (isScrolledToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers.length]);

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
        // Clear typing indicator for this sender immediately
        setTypingUsers((prev) => prev.filter((u) => u.userId !== newMsg.sender_id));

        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) {
            return prev;
          }

          const tempIdx = prev.findIndex(
            (m) =>
              m.id.startsWith('temp_') &&
              m.sender_id === newMsg.sender_id &&
              m.content.trim() === newMsg.content.trim()
          );

          if (tempIdx !== -1) {
            const next = [...prev];
            next[tempIdx] = { ...newMsg, status: 'sent' };
            return next;
          }

          return [...prev, newMsg];
        });
      }
    };

    const handleReaction = ({ messageId, groupId: rGid, reactions }: any) => {
      if (rGid === group.id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
        );
      }
    };

    const handleMessageDeleted = ({ messageId, groupId: dGid }: any) => {
      if (dGid === group.id) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    };

    const handleCallActive = (data: any) => {
      if (data.groupId === group.id) {
        setActiveCallInfo(data.active ? data : null);
      }
    };

    const handleCallEnded = (data: any) => {
      if (data.groupId === group.id) {
        setActiveCallInfo(null);
      }
    };

    const handleTyping = ({ groupId: incomingGroupId, userId, userName, userAvatar, isTyping }: any) => {
      if (incomingGroupId === group.id && userId !== user?.id) {
        setTypingUsers((prev) => {
          if (isTyping) {
            const existingIdx = prev.findIndex((u) => u.userId === userId);
            if (existingIdx !== -1) {
              const next = [...prev];
              next[existingIdx] = { userId, userName, userAvatar, lastActive: Date.now() };
              return next;
            }
            return [...prev, { userId, userName, userAvatar, lastActive: Date.now() }];
          } else {
            return prev.filter((u) => u.userId !== userId);
          }
        });
      }
    };

    socket.on('chat:message', handleIncomingMessage);
    socket.on('chat:reaction', handleReaction);
    socket.on('chat:message_deleted', handleMessageDeleted);
    socket.on('call:active', handleCallActive);
    socket.on('call:ended', handleCallEnded);
    socket.on('chat:typing', handleTyping);

    // Stale typing sweep timer
    const cleanupTimer = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        const active = prev.filter((u) => now - u.lastActive < 3500);
        return active.length === prev.length ? prev : active;
      });
    }, 1000);

    return () => {
      socket.off('chat:message', handleIncomingMessage);
      socket.off('chat:reaction', handleReaction);
      socket.off('chat:message_deleted', handleMessageDeleted);
      socket.off('call:active', handleCallActive);
      socket.off('call:ended', handleCallEnded);
      socket.off('chat:typing', handleTyping);
      clearInterval(cleanupTimer);
    };
  }, [socket, group.id, user?.id]);

  const handleSendMessage = async (content: string) => {
    if (!user) return;

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
      setMessages((prev) => {
        const alreadyHasReal = prev.some((m) => m.id === res.message.id);
        if (alreadyHasReal) {
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) => (m.id === tempId ? { ...res.message, status: 'sent' } : m));
      });
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
      );
      throw err;
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    setReactionError(null);

    try {
      const res = await api.toggleReaction(group.id, messageId, emoji);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions: res.reactions } : m))
      );
    } catch (err: any) {
      console.error('Failed to toggle reaction:', err);
      setReactionError({
        messageId,
        emoji,
        error: err.message || 'Failed to update reaction.',
      });
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await api.deleteMessage(group.id, messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error('Failed to delete message:', err);
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

  // Deduplicate messages by ID to guarantee uniqueness in rendering
  const uniqueMessages = React.useMemo(() => {
    const seen = new Set<string>();
    return messages.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [messages]);

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

      {/* Active Call Notification Banner (Feature 2) */}
      {activeCallInfo && activeCallInfo.active && (
        <div
          className="animate-slide-up"
          style={{
            padding: '10px 20px',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            borderBottom: '1px solid rgba(99, 102, 241, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 9,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--brand-primary)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {activeCallInfo.callType === 'voice' ? <Phone size={16} /> : <Video size={16} />}
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Active {activeCallInfo.callType === 'voice' ? 'Voice' : 'Video'} Call
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {activeCallInfo.participantCount || 1}{' '}
                {(activeCallInfo.participantCount || 1) === 1 ? 'person is' : 'people are'} currently in the call
              </div>
            </div>
          </div>

          {callStatus === 'idle' ? (
            <button
              onClick={() => joinCall(group.id)}
              style={{
                padding: '6px 16px',
                backgroundColor: 'var(--brand-primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)',
              }}
            >
              <Video size={14} /> Join Call
            </button>
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>
              Connected to Call
            </span>
          )}
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
        ) : uniqueMessages.length === 0 ? (
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
          uniqueMessages.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              isCurrentUser={msg.sender_id === user?.id}
              groupId={group.id}
              currentUserId={user?.id}
              canDelete={isAdminOrOwner}
              onRetry={handleRetryMessage}
              onPreviewAttachment={onPreviewAttachment}
              onToggleReaction={handleToggleReaction}
              onForward={(m) => setForwardingMessage(m)}
              onDelete={handleDeleteMessage}
            />
          ))
        )}

        {/* Animated Typing Indicator */}
        {typingUsers.length > 0 && <TypingIndicator users={typingUsers} />}

        <div ref={messagesEndRef} />
      </div>

      {/* Reaction Error Banner with Retry */}
      {reactionError && (
        <div
          style={{
            margin: '0 20px 8px 20px',
            padding: '8px 14px',
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            fontSize: '0.825rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <span>{reactionError.error}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => handleToggleReaction(reactionError.messageId, reactionError.emoji)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--danger)',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '0.8rem',
              }}
            >
              Retry
            </button>
            <button
              onClick={() => setReactionError(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Chat Input */}
      <ChatInput
        groupId={group.id}
        onSendMessage={handleSendMessage}
        onFileUploaded={loadMessages}
      />

      {/* Forward Message Modal (Feature 3) */}
      <ForwardMessageModal
        isOpen={!!forwardingMessage}
        onClose={() => setForwardingMessage(null)}
        message={forwardingMessage}
        currentGroupId={group.id}
      />
    </div>
  );
};
