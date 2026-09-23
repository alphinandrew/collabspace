import React, { useState } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Users, PlusCircle, ArrowRight, ShieldCheck, Zap, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface WelcomeScreenProps {
  onJoinGroup: () => void;
  onCreateGroup: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onJoinGroup,
  onCreateGroup,
}) => {
  const { user, login, register } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (authMode === 'register') {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--bg-app)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative ambient gradient backdrop */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '10%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-20%',
          right: '10%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="animate-slide-up"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: '40px 36px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '54px',
              height: '54px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--brand-gradient)',
              boxShadow: 'var(--shadow-glow)',
              marginBottom: '16px',
            }}
          >
            <Users size={28} color="#FFFFFF" />
          </div>

          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              marginBottom: '8px',
            }}
          >
            CollabSpace
          </h1>

          <p
            style={{
              fontSize: '1.05rem',
              fontWeight: 600,
              color: 'var(--brand-primary)',
              marginBottom: '6px',
            }}
          >
            Work together. Communicate better.
          </p>

          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              maxWidth: '380px',
              margin: '0 auto',
            }}
          >
            Join your team or create a workspace to get started.
          </p>
        </div>

        {/* If user is already authenticated, show primary actions */}
        {user ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                padding: '12px 16px',
                background: 'var(--bg-app)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'var(--brand-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    color: '#fff',
                    fontSize: '0.8rem',
                  }}
                >
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</div>
                </div>
              </div>
              <ShieldCheck size={18} color="var(--success)" />
            </div>

            <Button
              variant="primary"
              size="lg"
              style={{ width: '100%', height: '48px', fontSize: '0.95rem' }}
              onClick={onJoinGroup}
              icon={<Users size={18} />}
            >
              Join a Group
            </Button>

            <Button
              variant="secondary"
              size="lg"
              style={{ width: '100%', height: '48px', fontSize: '0.95rem' }}
              onClick={onCreateGroup}
              icon={<PlusCircle size={18} />}
            >
              Create a Group
            </Button>
          </div>
        ) : (
          /* Authentication Form */
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {authError && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--danger-bg)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--danger)',
                  fontSize: '0.85rem',
                }}
              >
                {authError}
              </div>
            )}

            {authMode === 'register' && (
              <Input
                label="Full Name"
                placeholder="e.g. Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}

            <Input
              label="Work Email"
              type="email"
              placeholder="alex@team.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              style={{ width: '100%', height: '46px', marginTop: '6px' }}
              loading={authLoading}
              icon={<ArrowRight size={18} />}
            >
              {authMode === 'register' ? 'Get Started' : 'Sign In'}
            </Button>

            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'register' ? 'login' : 'register');
                  setAuthError(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--brand-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {authMode === 'register'
                  ? 'Already have an account? Sign In'
                  : "Don't have an account? Create one"}
              </button>
            </div>
          </form>
        )}

        {/* Feature Badges */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            borderTop: '1px solid var(--border-subtle)',
            marginTop: '28px',
            paddingTop: '20px',
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={14} color="var(--brand-primary)" />
            Realtime Chat
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={14} color="var(--brand-primary)" />
            WebRTC Calls
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lock size={14} color="var(--brand-primary)" />
            Persistent Files
          </div>
        </div>
      </div>
    </div>
  );
};
