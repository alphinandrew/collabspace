import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { KeyRound, QrCode, Camera, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useGroup } from '../../context/GroupContext';
import { qrService } from '../../services/qr';

interface JoinGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const JoinGroupModal: React.FC<JoinGroupModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { joinByCode, joinByQr } = useGroup();
  const [tab, setTab] = useState<'code' | 'qr'>('code');
  const [code, setCode] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCode('');
      setQrToken('');
      setError(null);
      stopCamera();
    }
  }, [isOpen]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const handleStartCamera = async () => {
    setCameraError(null);
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Camera access denied or unavailable:', err);
      setCameraError('Camera access unavailable or permission was denied. You can join directly using the Group Code.');
      stopCamera();
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Please enter a group code.');
      return;
    }

    if (!trimmed.startsWith('CLB-') && trimmed.length < 4) {
      setError('Invalid format. Group codes typically follow the CLB-XXXX format.');
      return;
    }

    setLoading(true);
    try {
      await joinByCode(trimmed);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to join group. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByQr = async (tokenValue: string) => {
    setError(null);
    if (!tokenValue || !tokenValue.trim()) {
      setError('Invalid or empty invitation token.');
      return;
    }

    setLoading(true);
    try {
      await joinByQr(tokenValue.trim());
      stopCamera();
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to join group via QR token.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Join a Workspace Group" maxWidth="480px">
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '4px',
          background: 'var(--bg-app)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setTab('code');
            stopCamera();
            setError(null);
          }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            background: tab === 'code' ? 'var(--bg-surface-elevated)' : 'transparent',
            color: tab === 'code' ? 'var(--text-primary)' : 'var(--text-muted)',
            transition: 'all var(--transition-fast)',
          }}
        >
          <KeyRound size={16} />
          Group Code
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('qr');
            setError(null);
          }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            background: tab === 'qr' ? 'var(--bg-surface-elevated)' : 'transparent',
            color: tab === 'qr' ? 'var(--text-primary)' : 'var(--text-muted)',
            transition: 'all var(--transition-fast)',
          }}
        >
          <QrCode size={16} />
          Scan QR Code
        </button>
      </div>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '12px 14px',
            background: 'var(--danger-bg)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            fontSize: '0.875rem',
            marginBottom: '16px',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{error}</span>
        </div>
      )}

      {tab === 'code' ? (
        <form onSubmit={handleJoinByCode} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Enter the unique group code provided by your workspace admin or teammate.
          </p>

          <Input
            label="Group Code"
            placeholder="e.g. CLB-4729"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            leftIcon={<KeyRound size={18} />}
            autoFocus
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading}>
              Join Group
            </Button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Scan the invitation QR code displayed on your teammate's screen.
          </p>

          {cameraError ? (
            <div
              style={{
                padding: '16px',
                background: 'var(--warning-bg)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--warning)',
                fontSize: '0.875rem',
                display: 'flex',
                gap: '10px',
              }}
            >
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 600, marginBottom: '4px' }}>Camera Scanner Notice</p>
                <p>{cameraError}</p>
                <Button
                  size="sm"
                  variant="outline"
                  style={{ marginTop: '10px' }}
                  onClick={() => setTab('code')}
                >
                  Use Group Code Instead
                </Button>
              </div>
            </div>
          ) : isScanning ? (
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '240px',
                background: '#000000',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <video
                ref={videoRef}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                playsInline
                muted
              />
              <div
                style={{
                  position: 'absolute',
                  width: '160px',
                  height: '160px',
                  border: '2px solid var(--brand-primary)',
                  borderRadius: '12px',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                }}
              />
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '30px 20px',
                border: '2px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--bg-app)',
                gap: '12px',
              }}
            >
              <Camera size={36} color="var(--brand-primary)" />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>Scan with Camera</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Use your device camera to scan teammate QR invitations
                </p>
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={handleStartCamera}>
                Enable Camera Scanner
              </Button>
            </div>
          )}

          {/* Fallback QR token input */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            <Input
              label="Or Paste QR Invitation Token / Link"
              placeholder="e.g. d1d2cf6faf... or JSON payload"
              value={qrToken}
              onChange={(e) => {
                const val = e.target.value;
                setQrToken(val);
                const parsed = qrService.parseInvitationPayload(val);
                if (parsed?.token) {
                  handleJoinByQr(parsed.token);
                } else if (parsed?.code) {
                  setCode(parsed.code);
                  setTab('code');
                }
              }}
            />
            {qrToken && (
              <Button
                size="sm"
                variant="primary"
                style={{ marginTop: '10px' }}
                loading={loading}
                onClick={() => handleJoinByQr(qrToken)}
              >
                Redeem Token
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
