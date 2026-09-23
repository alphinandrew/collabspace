import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Avatar } from '../common/Avatar';
import { Copy, Check, Share2, ArrowRight } from 'lucide-react';
import { Group, InvitationData } from '../../services/api';

interface GroupInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group | null;
  invitation: InvitationData | null;
}

export const GroupInvitationModal: React.FC<GroupInvitationModalProps> = ({
  isOpen,
  onClose,
  group,
  invitation,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!group || !invitation) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(invitation.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      console.warn('Failed to copy to clipboard');
    }
  };

  const handleShare = async () => {
    const shareText = `Join our team on CollabSpace! Workspace: ${group.name} | Group Code: ${invitation.code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${group.name} on CollabSpace`,
          text: shareText,
          url: window.location.origin,
        });
        return;
      } catch (e) {
        // Fallback to clipboard
      }
    }
    await navigator.clipboard.writeText(shareText);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Your group is ready" maxWidth="480px">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '20px' }}>
        {/* Header Branding */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Avatar name={group.name} size="lg" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {group.name}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '360px' }}>
            Invite teammates using your unique workspace code or scan the QR invitation.
          </p>
        </div>

        {/* QR Code Container */}
        <div
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {invitation.qrDataUrl ? (
            <img
              src={invitation.qrDataUrl}
              alt={`QR code for ${group.name}`}
              style={{ width: '180px', height: '180px', display: 'block' }}
            />
          ) : (
            <div style={{ width: '180px', height: '180px', background: '#eee' }} />
          )}
        </div>

        {/* Code Display Box */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Group Code
            </span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--brand-primary)', letterSpacing: '0.05em' }}>
              {invitation.code}
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCopyCode}
            icon={copiedCode ? <Check size={16} color="var(--success)" /> : <Copy size={16} />}
          >
            {copiedCode ? 'Copied' : 'Copy'}
          </Button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', width: '100%', gap: '10px' }}>
          <Button
            variant="outline"
            style={{ flex: 1 }}
            onClick={handleShare}
            icon={copiedLink ? <Check size={16} color="var(--success)" /> : <Share2 size={16} />}
          >
            {copiedLink ? 'Copied Invite' : 'Share Invitation'}
          </Button>
          <Button
            variant="primary"
            style={{ flex: 1 }}
            onClick={onClose}
            icon={<ArrowRight size={16} />}
          >
            Continue to Group
          </Button>
        </div>
      </div>
    </Modal>
  );
};
