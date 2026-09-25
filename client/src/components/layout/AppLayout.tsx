import React, { useState } from 'react';
import { Sidebar, NavTab } from './Sidebar';
import { ContextPanel } from './ContextPanel';
import { ChatView } from '../chat/ChatView';
import { FileLibraryView } from '../files/FileLibraryView';
import { MembersView } from '../members/MembersView';
import { SettingsView } from '../settings/SettingsView';
import { JoinGroupModal } from '../onboarding/JoinGroupModal';
import { CreateGroupModal } from '../onboarding/CreateGroupModal';
import { GroupInvitationModal } from '../onboarding/GroupInvitationModal';
import { GlobalSearchModal } from '../search/GlobalSearchModal';
import { FilePreviewModal } from '../files/FilePreviewModal';
import { IncomingCallModal } from '../calls/IncomingCallModal';
import { CallOverlay } from '../calls/CallOverlay';
import { useGroup } from '../../context/GroupContext';
import { useCall } from '../../context/CallContext';
import { api, Group, InvitationData } from '../../services/api';
import { Phone, Video, Calendar, Clock, ArrowRight } from 'lucide-react';
import { Button } from '../common/Button';

export const AppLayout: React.FC = () => {
  const { activeGroup, activeMembers, selectGroup, groups } = useGroup();
  const { startCall, incomingCall, answerCall, declineCall } = useCall();

  const [activeTab, setActiveTab] = useState<NavTab>('chats');
  const [showContextPanel, setShowContextPanel] = useState(false);

  // Modals state
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [invitationGroup, setInvitationGroup] = useState<Group | null>(null);
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // File Preview Modal State
  const [previewFile, setPreviewFile] = useState<{ id: string; filename: string; mimeType?: string } | null>(null);

  const handleGroupCreated = (group: Group, invitation: InvitationData) => {
    setInvitationGroup(group);
    setInvitationData(invitation);
  };

  const handleOpenInvitationForCurrent = async () => {
    if (!activeGroup) return;
    try {
      const res = await api.getInvitation(activeGroup.id);
      setInvitationGroup(activeGroup);
      setInvitationData(res.invitation);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAnswerCall = async () => {
    if (incomingCall) {
      const targetGroup = groups.find((g) => g.id === incomingCall.groupId);
      if (targetGroup && targetGroup.id !== activeGroup?.id) {
        selectGroup(targetGroup);
      }
    }
    await answerCall();
  };

  if (!activeGroup) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          width: '100%',
          backgroundColor: 'var(--bg-app)',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            No groups yet
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Join a group or create your first workspace.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="primary" onClick={() => setIsJoinOpen(true)}>
            Join a Group
          </Button>
          <Button variant="secondary" onClick={() => setIsCreateOpen(true)}>
            Create a Group
          </Button>
        </div>

        <JoinGroupModal isOpen={isJoinOpen} onClose={() => setIsJoinOpen(false)} />
        <CreateGroupModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onCreated={handleGroupCreated}
        />
        <GroupInvitationModal
          isOpen={!!invitationGroup}
          onClose={() => setInvitationGroup(null)}
          group={invitationGroup}
          invitation={invitationData}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Sidebar Navigation & Workspaces */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenJoinModal={() => setIsJoinOpen(true)}
        onOpenCreateModal={() => setIsCreateOpen(true)}
        onOpenSearchModal={() => setIsSearchOpen(true)}
      />

      {/* Main Dynamic Workspace Content */}
      <main style={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative' }}>
        {activeTab === 'chats' && (
          <ChatView
            group={activeGroup}
            members={activeMembers}
            onStartCall={(type) => startCall(activeGroup.id, type)}
            onToggleInfo={() => setShowContextPanel(!showContextPanel)}
            onPreviewAttachment={(id, filename, mimeType) => setPreviewFile({ id, filename, mimeType })}
          />
        )}

        {activeTab === 'calls' && (
          <div
            style={{
              padding: '32px',
              height: '100%',
              backgroundColor: 'var(--bg-app)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              maxWidth: '800px',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Team Meetings & Calls
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Start instant voice or video calls with the #{activeGroup.name} team.
              </p>
            </div>

            {/* Quick Launcher Card */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
              }}
            >
              <div
                style={{
                  padding: '24px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--brand-primary-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Video size={22} color="var(--brand-primary)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Start Video Call</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>High-definition WebRTC video</p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  onClick={() => startCall(activeGroup.id, 'video')}
                  icon={<Video size={16} />}
                >
                  Join Video Room
                </Button>
              </div>

              <div
                style={{
                  padding: '24px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Phone size={22} color="var(--text-secondary)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Start Voice Call</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Low-latency audio only</p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => startCall(activeGroup.id, 'voice')}
                  icon={<Phone size={16} />}
                >
                  Join Audio Room
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'files' && <FileLibraryView group={activeGroup} />}
        {activeTab === 'members' && <MembersView group={activeGroup} />}
        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Right Contextual Panel (Collapsible) */}
      {showContextPanel && (
        <ContextPanel
          group={activeGroup}
          members={activeMembers}
          onClose={() => setShowContextPanel(false)}
          onOpenInvitation={handleOpenInvitationForCurrent}
          onStartCall={(type) => startCall(activeGroup.id, type)}
        />
      )}

      {/* Modals */}
      <JoinGroupModal isOpen={isJoinOpen} onClose={() => setIsJoinOpen(false)} />
      <CreateGroupModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleGroupCreated}
      />
      <GroupInvitationModal
        isOpen={!!invitationGroup}
        onClose={() => setInvitationGroup(null)}
        group={invitationGroup}
        invitation={invitationData}
      />
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectGroup={(groupId) => {
          const target = groups.find((g) => g.id === groupId);
          if (target) selectGroup(target);
        }}
        onPreviewFile={(id, filename, mimeType) => setPreviewFile({ id, filename, mimeType })}
      />
      {previewFile && (
        <FilePreviewModal
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          groupId={activeGroup.id}
          fileId={previewFile.id}
          filename={previewFile.filename}
          mimeType={previewFile.mimeType}
        />
      )}

      {/* Calling Overlays */}
      <IncomingCallModal
        incomingCall={incomingCall}
        onAnswer={handleAnswerCall}
        onDecline={declineCall}
      />
      <CallOverlay />
    </div>
  );
};
