import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../common/Avatar';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { User, Bell, Palette, Shield, LogOut, Check } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { user, updateProfile, logout } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [status, setStatus] = useState(user?.status || 'online');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Settings preferences
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [messageSound, setMessageSound] = useState(true);
  const [callAlerts, setCallAlerts] = useState(true);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), status });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  if (!user) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-app)',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Workspace Settings & Preferences
        </h2>
        <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Manage your personal identity, theme preferences, and security settings.
        </p>
      </div>

      <div
        style={{
          padding: '24px',
          maxWidth: '640px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Profile Card */}
        <div
          style={{
            padding: '20px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <User size={18} color="var(--brand-primary)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Profile Identity</h3>
          </div>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Avatar name={user.name} src={user.avatar} size="lg" status={status} />
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{user.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user.email}</div>
              </div>
            </div>

            <Input
              label="Display Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Presence Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              >
                <option value="online" style={{ background: '#1E293B' }}>Online (Available)</option>
                <option value="away" style={{ background: '#1E293B' }}>Away</option>
                <option value="busy" style={{ background: '#1E293B' }}>Busy / In Call</option>
                <option value="offline" style={{ background: '#1E293B' }}>Invisible / Offline</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <Button
                type="submit"
                variant="primary"
                loading={saving}
                icon={savedSuccess ? <Check size={16} /> : undefined}
              >
                {savedSuccess ? 'Saved' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>

        {/* Appearance Card */}
        <div
          style={{
            padding: '20px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Palette size={18} color="var(--brand-primary)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Appearance & Themes</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              type="button"
              onClick={() => handleThemeChange('dark')}
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: theme === 'dark' ? 'var(--brand-primary-light)' : 'var(--bg-app)',
                border: theme === 'dark' ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                color: theme === 'dark' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              🌙 Dark Obsidian (Default)
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange('light')}
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: theme === 'light' ? 'var(--brand-primary-light)' : 'var(--bg-app)',
                border: theme === 'light' ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                color: theme === 'light' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              ☀️ Clean Light
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div
          style={{
            padding: '20px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Bell size={18} color="var(--brand-primary)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Notifications & Alerts</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>Message Notifications</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Play subtle chime when receiving new chat messages</div>
              </div>
              <input
                type="checkbox"
                checked={messageSound}
                onChange={(e) => setMessageSound(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
              />
            </label>

            <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>Incoming Call Alerts</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Display ringing modal when team starts a call</div>
              </div>
              <input
                type="checkbox"
                checked={callAlerts}
                onChange={(e) => setCallAlerts(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
              />
            </label>
          </div>
        </div>

        {/* Security & Sign Out */}
        <div
          style={{
            padding: '20px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Shield size={18} color="var(--danger)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Session & Security</h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>Active Session</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Signed in securely with JWT token authentication
              </div>
            </div>
            <Button variant="danger" size="sm" onClick={logout} icon={<LogOut size={15} />}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
