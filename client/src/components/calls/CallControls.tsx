import React from 'react';
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff } from 'lucide-react';

interface CallControlsProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onEndCall: () => void;
}

export const CallControls: React.FC<CallControlsProps> = ({
  isMuted,
  isCameraOff,
  isScreenSharing,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onEndCall,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        padding: '14px 24px',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        borderRadius: 'var(--radius-full)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {/* Microphone Toggle */}
      <button
        onClick={onToggleMute}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          backgroundColor: isMuted ? 'var(--danger)' : 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          color: '#FFFFFF',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
        }}
        title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
      >
        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
      </button>

      {/* Camera Toggle */}
      <button
        onClick={onToggleCamera}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          backgroundColor: isCameraOff ? 'var(--danger)' : 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          color: '#FFFFFF',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
        }}
        title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
      >
        {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
      </button>

      {/* Screen Sharing Toggle */}
      <button
        onClick={onToggleScreenShare}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          backgroundColor: isScreenSharing ? 'var(--brand-primary)' : 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          color: '#FFFFFF',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
        }}
        title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
      >
        <MonitorUp size={20} />
      </button>

      {/* End Call Button */}
      <button
        onClick={onEndCall}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          backgroundColor: 'var(--danger)',
          border: 'none',
          color: '#FFFFFF',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
        }}
        title="Leave or End Call"
      >
        <PhoneOff size={20} />
      </button>
    </div>
  );
};
