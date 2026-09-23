import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Avatar } from '../common/Avatar';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { IncomingCallData } from '../../context/CallContext';

interface IncomingCallModalProps {
  incomingCall: IncomingCallData | null;
  onAnswer: () => void;
  onDecline: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  incomingCall,
  onAnswer,
  onDecline,
}) => {
  if (!incomingCall) return null;

  return (
    <Modal isOpen={!!incomingCall} onClose={onDecline} title="Incoming Team Call" maxWidth="400px">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '20px' }}>
        <div style={{ position: 'relative' }}>
          <Avatar name={incomingCall.initiator.name} src={incomingCall.initiator.avatar} size="xl" />
          <span
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)',
            }}
          >
            {incomingCall.callType === 'video' ? <Video size={13} /> : <Phone size={13} />}
          </span>
        </div>

        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {incomingCall.initiator.name}
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            is inviting you to a {incomingCall.callType} call...
          </p>
        </div>

        <div style={{ display: 'flex', width: '100%', gap: '12px' }}>
          <Button
            variant="danger"
            style={{ flex: 1 }}
            onClick={onDecline}
            icon={<PhoneOff size={16} />}
          >
            Decline
          </Button>
          <Button
            variant="primary"
            style={{ flex: 1, backgroundColor: 'var(--success)' }}
            onClick={onAnswer}
            icon={<Phone size={16} />}
          >
            Accept
          </Button>
        </div>
      </div>
    </Modal>
  );
};
