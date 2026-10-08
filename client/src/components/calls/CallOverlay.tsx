import React, { useEffect, useRef, useState } from 'react';
import { useCall, RemoteParticipant } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import { useGroup } from '../../context/GroupContext';
import { CallControls } from './CallControls';
import { ChatView } from '../chat/ChatView';
import { Avatar } from '../common/Avatar';
import { Phone, Video, AlertCircle, Loader2, MessageSquare, X } from 'lucide-react';

interface ParticipantTileProps {
  stream?: MediaStream;
  name: string;
  avatar?: string | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing?: boolean;
  isLocal?: boolean;
}

const ParticipantTile: React.FC<ParticipantTileProps> = ({
  stream,
  name,
  avatar,
  isMuted,
  isCameraOff,
  isScreenSharing = false,
  isLocal = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Reliable video element attachment via callback ref
  const attachVideoRef = React.useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (node && stream) {
        if (node.srcObject !== stream) {
          node.srcObject = stream;
        }
        node.play().catch((err) => {
          console.warn(`[WebRTC] video.play() note for ${name}:`, err.message);
        });
      }
    },
    [stream, name]
  );

  // Keep srcObject synchronized whenever stream or camera state updates
  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch((err) => {
        console.warn(`[WebRTC] video.play() note for ${name}:`, err.message);
      });
    }
  }, [stream, isCameraOff, isScreenSharing, name]);

  const showVideo = stream && (!isCameraOff || isScreenSharing);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: isScreenSharing ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isScreenSharing ? '0 0 20px rgba(34, 197, 94, 0.35)' : 'var(--shadow-md)',
      }}
    >
      {/* Video Element */}
      {showVideo ? (
        <video
          ref={attachVideoRef}
          autoPlay
          playsInline
          muted={isLocal} // mute local playback to avoid audio feedback echo
          style={{
            width: '100%',
            height: '100%',
            objectFit: isScreenSharing ? 'contain' : 'cover',
            backgroundColor: '#000000',
            transform: isLocal && !isScreenSharing ? 'scaleX(-1)' : 'none',
          }}
        />
      ) : (
        /* Camera Off Fallback: Avatar */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          {/* Ensure audio still plays when video element is not mounted */}
          {!isLocal && stream && (
            <audio
              autoPlay
              ref={(node) => {
                if (node && node.srcObject !== stream) {
                  node.srcObject = stream;
                  node.play().catch((e) => console.warn('[WebRTC] audio play note:', e));
                }
              }}
            />
          )}
          <Avatar name={name} src={avatar} size="xl" />
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {name} {isLocal && '(You)'}
          </span>
        </div>
      )}

      {/* Participant Name & Status Label */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          padding: '4px 10px',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.75rem',
          color: '#FFFFFF',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span>{name} {isLocal && '(You)'}</span>
        {isScreenSharing && (
          <span
            style={{
              backgroundColor: 'var(--brand-primary)',
              color: '#FFFFFF',
              padding: '1px 6px',
              borderRadius: '4px',
              fontSize: '0.65rem',
              fontWeight: 600,
            }}
          >
            Presenting
          </span>
        )}
        {isMuted && <span style={{ color: 'var(--danger)', fontSize: '0.7rem' }}>• Muted</span>}
      </div>
    </div>
  );
};

export const CallOverlay: React.FC = () => {
  const {
    callStatus,
    callType,
    activeGroupId,
    localStream,
    remoteParticipants,
    isMuted,
    isCameraOff,
    isScreenSharing,
    errorMessage,
    leaveCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    retryCall,
  } = useCall();
  const { user } = useAuth();
  const { groups, activeGroup, activeMembers } = useGroup();

  const [isChatOpen, setIsChatOpen] = useState(false);

  if (callStatus === 'idle') return null;

  const participantsList = Array.from(remoteParticipants.values());
  const callGroup = (activeGroupId && groups.find((g) => g.id === activeGroupId)) || activeGroup;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'var(--bg-app)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Call Header */}
      <div
        style={{
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'rgba(18, 21, 18, 0.92)',
          backdropFilter: 'blur(8px)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--brand-primary-light)',
              color: 'var(--brand-primary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {callType === 'video' ? <Video size={14} /> : <Phone size={14} />}
            {callType === 'video' ? 'Team Video Call' : 'Team Voice Call'}
          </div>

          <span
            style={{
              fontSize: '0.85rem',
              color:
                callStatus === 'connected'
                  ? 'var(--success)'
                  : callStatus === 'ringing' || (participantsList.length === 0 && callStatus !== 'failed')
                  ? 'var(--warning)'
                  : callStatus === 'failed'
                  ? 'var(--danger)'
                  : 'var(--text-muted)',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {callStatus === 'connecting' && <Loader2 size={14} className="animate-spin" />}
            Status: {participantsList.length === 0 && (callStatus === 'ringing' || callStatus === 'connecting')
              ? 'WAITING FOR MEMBERS'
              : callStatus.toUpperCase()}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {participantsList.length + 1} in call
          </div>

          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            style={{
              padding: '6px 12px',
              backgroundColor: isChatOpen ? 'var(--brand-primary)' : 'var(--bg-surface-elevated)',
              color: '#FFFFFF',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all var(--transition-fast)',
            }}
          >
            <MessageSquare size={14} />
            <span>Chat</span>
          </button>
        </div>
      </div>

      {/* Error alert banner with retry action */}
      {errorMessage && (
        <div
          style={{
            padding: '10px 24px',
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={retryCall}
            style={{
              padding: '4px 14px',
              backgroundColor: 'var(--brand-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Main Workspace Area: Call Media + In-Call Chat Drawer (Feature 1) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Left Side: Video/Voice Participants + Floating Call Controls */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minWidth: 0,
            position: 'relative',
          }}
        >
          {/* Video Grid Area */}
          <div
            style={{
              flex: 1,
              padding: '24px',
              display: 'grid',
              gridTemplateColumns:
                participantsList.length === 0
                  ? '1fr'
                  : participantsList.length === 1
                  ? '1fr 1fr'
                  : 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px',
              alignItems: 'center',
              justifyContent: 'center',
              overflowY: 'auto',
            }}
          >
            {/* Local Participant Tile */}
            <ParticipantTile
              stream={localStream || undefined}
              name={user?.name || 'You'}
              avatar={user?.avatar}
              isMuted={isMuted}
              isCameraOff={isCameraOff}
              isScreenSharing={isScreenSharing}
              isLocal={true}
            />

            {/* Remote Participant Tiles */}
            {participantsList.map((peer) => (
              <ParticipantTile
                key={peer.socketId}
                stream={peer.stream}
                name={peer.user.name}
                avatar={peer.user.avatar}
                isMuted={peer.isMuted}
                isCameraOff={peer.isCameraOff}
                isScreenSharing={peer.isScreenSharing}
                isLocal={false}
              />
            ))}
          </div>

          {/* Floating Bottom Call Controls */}
          <div
            style={{
              padding: '20px',
              display: 'flex',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              position: 'relative',
              zIndex: 10,
            }}
          >
            <CallControls
              isMuted={isMuted}
              isCameraOff={isCameraOff}
              isScreenSharing={isScreenSharing}
              isChatOpen={isChatOpen}
              onToggleMute={toggleMute}
              onToggleCamera={toggleCamera}
              onToggleScreenShare={toggleScreenShare}
              onToggleChat={() => setIsChatOpen(!isChatOpen)}
              onEndCall={leaveCall}
            />
          </div>
        </div>

        {/* Right Side: Persistent In-Call Group Chat (Feature 1) */}
        {isChatOpen && callGroup && (
          <div
            className="animate-slide-up"
            style={{
              width: '390px',
              maxWidth: '100%',
              height: '100%',
              borderLeft: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 20,
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <div
              style={{
                padding: '12px 18px',
                backgroundColor: 'var(--bg-surface-elevated)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={16} color="var(--brand-primary)" />
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  In-Call Group Chat
                </span>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Close chat panel"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
              <ChatView
                group={callGroup}
                members={activeMembers}
                onStartCall={() => {}}
                onToggleInfo={() => {}}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
