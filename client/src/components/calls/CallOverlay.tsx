import React, { useEffect, useRef } from 'react';
import { useCall, RemoteParticipant } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import { CallControls } from './CallControls';
import { Avatar } from '../common/Avatar';
import { Phone, Video, AlertCircle, Loader2 } from 'lucide-react';

interface ParticipantTileProps {
  stream?: MediaStream;
  name: string;
  avatar?: string | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isLocal?: boolean;
}

const ParticipantTile: React.FC<ParticipantTileProps> = ({
  stream,
  name,
  avatar,
  isMuted,
  isCameraOff,
  isLocal = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#0F172A',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Video Element */}
      {stream && !isCameraOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // mute local playback to avoid audio feedback echo
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: isLocal ? 'scaleX(-1)' : 'none',
          }}
        />
      ) : (
        /* Camera Off Fallback: Avatar */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
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
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
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
        {isMuted && <span style={{ color: 'var(--danger)', fontSize: '0.7rem' }}>• Muted</span>}
      </div>
    </div>
  );
};

export const CallOverlay: React.FC = () => {
  const {
    callStatus,
    callType,
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
  } = useCall();
  const { user } = useAuth();

  if (callStatus === 'idle') return null;

  const participantsList = Array.from(remoteParticipants.values());

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: '#070A12',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Call Header */}
      <div
        style={{
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(8px)',
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
                  : callStatus === 'ringing'
                  ? 'var(--warning)'
                  : 'var(--text-muted)',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {callStatus === 'connecting' && <Loader2 size={14} className="animate-spin" />}
            Status: {callStatus.toUpperCase()}
          </span>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {participantsList.length + 1} in call
        </div>
      </div>

      {/* Error alert banner */}
      {errorMessage && (
        <div
          style={{
            padding: '10px 24px',
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

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
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onToggleScreenShare={toggleScreenShare}
          onEndCall={leaveCall}
        />
      </div>
    </div>
  );
};
