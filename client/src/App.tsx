import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GroupProvider, useGroup } from './context/GroupContext';
import { SocketProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import { WelcomeScreen } from './components/onboarding/WelcomeScreen';
import { AppLayout } from './components/layout/AppLayout';
import { JoinGroupModal } from './components/onboarding/JoinGroupModal';
import { CreateGroupModal } from './components/onboarding/CreateGroupModal';
import { GroupInvitationModal } from './components/onboarding/GroupInvitationModal';
import { Group, InvitationData } from './services/api';
import { Loader2 } from 'lucide-react';

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Frontend ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '16px',
            backgroundColor: '#080C14',
            color: '#F8FAFC',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Something went wrong</h2>
          <p style={{ color: '#94A3B8', maxWidth: '420px', fontSize: '0.9rem' }}>
            An unexpected error occurred in the workspace interface.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6366F1',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload Workspace
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const MainAppContent: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { groups, loadingGroups, activeGroup } = useGroup();

  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [invitationGroup, setInvitationGroup] = useState<Group | null>(null);
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);

  if (authLoading || (user && loadingGroups && groups.length === 0)) {
    return (
      <div
        style={{
          height: '100vh',
          width: '100vw',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-app)',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <Loader2 size={36} color="var(--brand-primary)" className="animate-spin" />
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Loading CollabSpace...
        </span>
      </div>
    );
  }

  // First-launch or unauthenticated experience: show WelcomeScreen
  if (!user || (groups.length === 0 && !activeGroup)) {
    return (
      <>
        <WelcomeScreen
          onJoinGroup={() => setIsJoinOpen(true)}
          onCreateGroup={() => setIsCreateOpen(true)}
        />
        <JoinGroupModal
          isOpen={isJoinOpen}
          onClose={() => setIsJoinOpen(false)}
        />
        <CreateGroupModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onCreated={(group, inv) => {
            setInvitationGroup(group);
            setInvitationData(inv);
          }}
        />
        <GroupInvitationModal
          isOpen={!!invitationGroup}
          onClose={() => setInvitationGroup(null)}
          group={invitationGroup}
          invitation={invitationData}
        />
      </>
    );
  }

  return <AppLayout />;
};

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <GroupProvider>
          <SocketProvider>
            <CallProvider>
              <MainAppContent />
            </CallProvider>
          </SocketProvider>
        </GroupProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
