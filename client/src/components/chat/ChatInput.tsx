import React, { useState, useRef } from 'react';
import { Paperclip, Send, X, AlertCircle, RotateCcw } from 'lucide-react';
import { api } from '../../services/api';

interface ChatInputProps {
  groupId: string;
  onSendMessage: (content: string) => Promise<void>;
  onFileUploaded: () => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  groupId,
  onSendMessage,
  onFileUploaded,
  disabled = false,
}) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isSendingRef = useRef(false);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = text.trim();
    if (!content || sending || isSendingRef.current) return;

    isSendingRef.current = true;
    setText('');
    setSending(true);
    try {
      await onSendMessage(content);
    } catch (err) {
      // Restore text if failed
      setText(content);
    } finally {
      setSending(false);
      isSendingRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingFile(file);
    uploadSelectedFile(file);

    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const uploadSelectedFile = async (file: File) => {
    setUploadError(null);
    setUploadProgress(0);

    try {
      await api.uploadFileWithProgress(groupId, file, (percent) => {
        setUploadProgress(percent);
      });
      setUploadProgress(null);
      setPendingFile(null);
      onFileUploaded();
    } catch (err: any) {
      setUploadError(err.message || 'File upload failed.');
      setUploadProgress(null);
    }
  };

  return (
    <div
      style={{
        padding: '12px 20px',
        backgroundColor: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Upload Progress / Error Banner */}
      {uploadProgress !== null && (
        <div
          className="animate-slide-up"
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.825rem',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontWeight: 600 }}>Uploading {pendingFile?.name}...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div
              style={{
                width: '100%',
                height: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '999px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${uploadProgress}%`,
                  height: '100%',
                  backgroundColor: 'var(--brand-primary)',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {uploadError && (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'var(--danger)',
            fontSize: '0.825rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={15} />
            <span>Upload failed: {uploadError}</span>
          </div>
          {pendingFile && (
            <button
              onClick={() => uploadSelectedFile(pendingFile)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--danger)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.8rem',
              }}
            >
              <RotateCcw size={12} /> Retry
            </button>
          )}
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '10px',
          backgroundColor: 'var(--bg-app)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '8px 12px',
          transition: 'border-color var(--transition-fast)',
        }}
      >
        {/* Hidden File Picker */}
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {/* Paperclip Button */}
        <button
          type="button"
          disabled={disabled || uploadProgress !== null}
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color var(--transition-fast)',
          }}
          title="Share document or file"
        >
          <Paperclip size={18} />
        </button>

        {/* Textarea */}
        <textarea
          rows={1}
          placeholder="Message workspace..."
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            resize: 'none',
            maxHeight: '120px',
            lineHeight: 1.4,
            padding: '4px 0',
          }}
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={disabled || !text.trim() || sending}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '34px',
            height: '34px',
            borderRadius: 'var(--radius-md)',
            background: text.trim() ? 'var(--brand-primary)' : 'var(--bg-surface-elevated)',
            border: 'none',
            color: text.trim() ? '#FFFFFF' : 'var(--text-muted)',
            cursor: text.trim() && !sending ? 'pointer' : 'default',
            transition: 'all var(--transition-fast)',
          }}
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
};
