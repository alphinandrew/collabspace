export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  status: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  avatar: string | null;
  owner_id: string;
  join_code: string;
  created_at: string;
  user_role?: string;
  member_count?: number;
  message_count?: number;
  last_activity?: string;
}

export interface Member {
  membership_id: string;
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  status: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export interface Message {
  id: string;
  group_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  content: string;
  message_type: 'text' | 'file' | 'system';
  created_at: string;
  file_id?: string;
  filename?: string;
  mime_type?: string;
  file_size?: number;
  status?: 'sending' | 'sent' | 'failed';
}

export interface FileItem {
  id: string;
  group_id: string;
  uploader_id: string;
  uploader_name: string;
  uploader_avatar: string | null;
  filename: string;
  storage_key: string;
  mime_type: string;
  size: number;
  created_at: string;
}

export interface InvitationData {
  code: string;
  token: string;
  expiresAt: string;
  qrDataUrl: string;
}

const TOKEN_KEY = 'collabspace_auth_token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStorage.get();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.error || (typeof data === 'string' ? data : 'API Request failed');
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // Auth
  register: (name: string, email: string, password: string) =>
    apiRequest<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string) =>
    apiRequest<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  forgotPassword: (email: string) =>
    apiRequest<{ message: string; code?: string; expiresInMinutes?: number; notice?: string }>(
      '/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      }
    ),

  resetPassword: (email: string, code: string, newPassword: string) =>
    apiRequest<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword }),
    }),

  getMe: () => apiRequest<{ user: User }>('/auth/me'),

  updateProfile: (profile: Partial<User>) =>
    apiRequest<{ user: User }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    }),

  logout: () => apiRequest<{ message: string }>('/auth/logout', { method: 'POST' }),

  // Groups
  getMyGroups: () => apiRequest<{ groups: Group[] }>('/groups'),

  createGroup: (name: string, description?: string, avatar?: string) =>
    apiRequest<{ group: Group; invitation: InvitationData }>('/groups', {
      method: 'POST',
      body: JSON.stringify({ name, description, avatar }),
    }),

  joinByCode: (code: string) =>
    apiRequest<{ group: Group }>('/groups/join-code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  joinByQr: (token: string) =>
    apiRequest<{ group: Group }>('/groups/join-qr', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  getGroupDetails: (groupId: string) =>
    apiRequest<{ group: Group; members: Member[]; stats: { memberCount: number; fileCount: number; totalFileSize: number }; userRole: string }>(
      `/groups/${groupId}`
    ),

  getInvitation: (groupId: string) =>
    apiRequest<{ invitation: InvitationData }>(`/groups/${groupId}/invitation`),

  listMembers: (groupId: string) =>
    apiRequest<{ members: Member[] }>(`/groups/${groupId}/members`),

  updateMemberRole: (groupId: string, userId: string, role: 'admin' | 'member') =>
    apiRequest<{ member: Member }>(`/groups/${groupId}/members/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  removeMember: (groupId: string, userId: string) =>
    apiRequest<{ message: string }>(`/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
    }),

  // Messages
  getMessages: (groupId: string, limit = 50, before?: string) => {
    let url = `/groups/${groupId}/messages?limit=${limit}`;
    if (before) url += `&before=${encodeURIComponent(before)}`;
    return apiRequest<{ messages: Message[] }>(url);
  },

  sendMessage: (groupId: string, content: string, messageType = 'text', fileId?: string) =>
    apiRequest<{ message: Message }>(`/groups/${groupId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, messageType, fileId }),
    }),

  // Files
  getFiles: (groupId: string, params: { category?: string; search?: string; sort?: string; limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.category) query.set('category', params.category);
    if (params.search) query.set('search', params.search);
    if (params.sort) query.set('sort', params.sort);
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.offset) query.set('offset', params.offset.toString());
    return apiRequest<{ files: FileItem[]; total: number; totalSize: number }>(`/groups/${groupId}/files?${query.toString()}`);
  },

  uploadFileWithProgress: (
    groupId: string,
    file: File,
    onProgress?: (percentage: number) => void
  ): Promise<{ file: FileItem; chatMessage: Message }> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      xhr.open('POST', `/api/groups/${groupId}/files`);

      const token = tokenStorage.get();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch (e) {
            reject(new Error('Invalid response from server.'));
          }
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            reject(new Error(data.error || 'Upload failed'));
          } catch (e) {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error during file upload.'));
      xhr.send(formData);
    });
  },

  downloadFile: async (groupId: string, fileId: string, filename: string) => {
    const token = tokenStorage.get();
    const response = await fetch(`/api/groups/${groupId}/files/${fileId}/download`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  },

  // Calls
  initiateCall: (groupId: string, callType: 'voice' | 'video' = 'video') =>
    apiRequest<{ call: any; isExisting: boolean }>(`/groups/${groupId}/calls`, {
      method: 'POST',
      body: JSON.stringify({ callType }),
    }),

  getActiveCall: (groupId: string) =>
    apiRequest<{ call: any | null }>(`/groups/${groupId}/calls/active`),

  endCall: (groupId: string, callId: string) =>
    apiRequest<{ message: string }>(`/groups/${groupId}/calls/${callId}/end`, {
      method: 'POST',
    }),

  // Search
  searchGroup: (groupId: string, query: string) =>
    apiRequest<{ query: string; messages: Message[]; files: FileItem[]; members: Member[] }>(
      `/groups/${groupId}/search?q=${encodeURIComponent(query)}`
    ),

  searchGlobal: (query: string) =>
    apiRequest<{ query: string; messages: Message[]; files: FileItem[]; groups: Group[] }>(
      `/search?q=${encodeURIComponent(query)}`
    ),

  // WebRTC ICE servers
  getWebRtcConfig: () => apiRequest<{ iceServers: RTCIceServer[] }>('/config/webrtc'),
};
