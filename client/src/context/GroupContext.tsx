import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, Group, InvitationData, Member } from '../services/api';
import { useAuth } from './AuthContext';

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
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [activeMembers, setActiveMembers] = useState<Member[]>([]);
  const [loadingGroups, setLoadingGroups] = useState<boolean>(false);

  const refreshGroups = useCallback(async () => {
    if (!user) {
      setGroups([]);
      setActiveGroup(null);
      return;
    }
    setLoadingGroups(true);
    try {
      const res = await api.getMyGroups();
      setGroups(res.groups);
      if (res.groups.length > 0 && !activeGroup) {
        // Select first group by default
        setActiveGroup(res.groups[0]);
      } else if (activeGroup) {
        // Update active group data
        const updated = res.groups.find((g) => g.id === activeGroup.id);
        if (updated) setActiveGroup(updated);
      }
    } catch (err) {
      console.error('Failed to load user groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  }, [user, activeGroup]);

  useEffect(() => {
    if (user) {
      refreshGroups();
    } else {
      setGroups([]);
      setActiveGroup(null);
      setActiveMembers([]);
    }
  }, [user]);

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
      refreshActiveGroupMembers();
    }
  }, [activeGroup, refreshActiveGroupMembers]);

  const selectGroup = (group: Group) => {
    setActiveGroup(group);
  };

  const createGroup = async (name: string, description?: string, avatar?: string) => {
    const res = await api.createGroup(name, description, avatar);
    setGroups((prev) => [res.group, ...prev]);
    setActiveGroup(res.group);
    return res;
  };

  const joinByCode = async (code: string) => {
    const res = await api.joinByCode(code);
    setGroups((prev) => {
      const exists = prev.some((g) => g.id === res.group.id);
      if (exists) return prev;
      return [res.group, ...prev];
    });
    setActiveGroup(res.group);
    return res.group;
  };

  const joinByQr = async (token: string) => {
    const res = await api.joinByQr(token);
    setGroups((prev) => {
      const exists = prev.some((g) => g.id === res.group.id);
      if (exists) return prev;
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
