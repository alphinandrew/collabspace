import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, Group, InvitationData, Member } from '../services/api';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

interface GroupContextType {
  groups: Group[];
  activeGroup: Group | null;
  activeMembers: Member[];
  loadingGroups: boolean;
  selectGroup: (group: Group) => void;
  createGroup: (name: string, description?: string, avatar?: string) => Promise<{ group: Group; invitation: InvitationData }>;
  joinByCode: (code: string) => Promise<Group>;
  joinByQr: (token: string) => Promise<Group>;
  refreshGroups: () => Promise<void>;
  refreshActiveGroupMembers: () => Promise<void>;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export const GroupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [activeMembers, setActiveMembers] = useState<Member[]>([]);
  const [loadingGroups, setLoadingGroups] = useState<boolean>(true);

  const refreshGroups = useCallback(async () => {
    if (!user) {
      setGroups([]);
      setActiveGroup(null);
      setLoadingGroups(false);
      return;
    }
    setLoadingGroups(true);
    try {
      const res = await api.getMyGroups();
      setGroups(res.groups);
      if (res.groups.length > 0) {
        const savedId = localStorage.getItem('collabspace_last_active_group');
        const matched = savedId ? res.groups.find((g) => g.id === savedId) : null;
        setActiveGroup((prev) => {
          if (prev && res.groups.some((g) => g.id === prev.id)) {
            return res.groups.find((g) => g.id === prev.id) || prev;
          }
          return matched || res.groups[0];
        });
      } else {
        setActiveGroup(null);
      }
    } catch (err) {
      console.error('Failed to load user groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshGroups();
    } else {
      setGroups([]);
      setActiveGroup(null);
      setActiveMembers([]);
      setLoadingGroups(false);
    }
  }, [user, refreshGroups]);

  const refreshActiveGroupMembers = useCallback(async () => {
    if (!activeGroup) return;
    try {
      const res = await api.listMembers(activeGroup.id);
      setActiveMembers(res.members);
    } catch (err) {
      console.error('Failed to load group members:', err);
    }
  }, [activeGroup]);

  useEffect(() => {
    if (activeGroup) {
      localStorage.setItem('collabspace_last_active_group', activeGroup.id);
      refreshActiveGroupMembers();
    }
  }, [activeGroup, refreshActiveGroupMembers]);

  // Realtime member removal and group deletion listeners
  useEffect(() => {
    if (!socket) return;

    const handleMemberRemoved = ({ groupId, userId, isSelf }: any) => {
      if (isSelf || userId === user?.id) {
        setGroups((prev) => prev.filter((g) => g.id !== groupId));
        if (activeGroup?.id === groupId) {
          localStorage.removeItem('collabspace_last_active_group');
          refreshGroups();
        }
      } else if (activeGroup?.id === groupId) {
        refreshActiveGroupMembers();
      }
    };

    const handleGroupDeleted = ({ groupId }: any) => {
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      if (activeGroup?.id === groupId) {
        localStorage.removeItem('collabspace_last_active_group');
        refreshGroups();
      }
    };

    socket.on('group:member_removed', handleMemberRemoved);
    socket.on('group:deleted', handleGroupDeleted);

    return () => {
      socket.off('group:member_removed', handleMemberRemoved);
      socket.off('group:deleted', handleGroupDeleted);
    };
  }, [socket, user?.id, activeGroup?.id, refreshGroups, refreshActiveGroupMembers]);

  const selectGroup = (group: Group) => {
    localStorage.setItem('collabspace_last_active_group', group.id);
    setActiveGroup(group);
  };

  const createGroup = async (name: string, description?: string, avatar?: string) => {
    const res = await api.createGroup(name, description, avatar);
    localStorage.setItem('collabspace_last_active_group', res.group.id);
    setGroups((prev) => [res.group, ...prev]);
    setActiveGroup(res.group);
    return res;
  };

  const joinByCode = async (code: string) => {
    const res = await api.joinByCode(code);
    localStorage.setItem('collabspace_last_active_group', res.group.id);
    setGroups((prev) => {
      const exists = prev.some((g) => g.id === res.group.id);
      if (exists) {
        return prev.map((g) => (g.id === res.group.id ? res.group : g));
      }
      return [res.group, ...prev];
    });
    setActiveGroup(res.group);
    return res.group;
  };

  const joinByQr = async (token: string) => {
    const res = await api.joinByQr(token);
    localStorage.setItem('collabspace_last_active_group', res.group.id);
    setGroups((prev) => {
      const exists = prev.some((g) => g.id === res.group.id);
      if (exists) {
        return prev.map((g) => (g.id === res.group.id ? res.group : g));
      }
      return [res.group, ...prev];
    });
    setActiveGroup(res.group);
    return res.group;
  };

  return (
    <GroupContext.Provider
      value={{
        groups,
        activeGroup,
        activeMembers,
        loadingGroups,
        selectGroup,
        createGroup,
        joinByCode,
        joinByQr,
        refreshGroups,
        refreshActiveGroupMembers,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
};

export const useGroup = () => {
  const context = useContext(GroupContext);
  if (!context) throw new Error('useGroup must be used within a GroupProvider');
  return context;
};
