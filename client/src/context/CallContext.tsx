import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { useGroup } from './GroupContext';
import { api, User } from '../services/api';

export type CallStatus = 'idle' | 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed';

export interface RemoteParticipant {
  socketId: string;
  user: User;
  stream?: MediaStream;
  isMuted: boolean;
  isCameraOff: boolean;
}

export interface IncomingCallData {
  groupId: string;
  callId: string;
  callType: 'voice' | 'video';
  initiator: User;
}

interface CallContextType {
  callStatus: CallStatus;
  callType: 'voice' | 'video';
  activeCallId: string | null;
  activeGroupId: string | null;
  localStream: MediaStream | null;
  remoteParticipants: Map<string, RemoteParticipant>;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  incomingCall: IncomingCallData | null;
  errorMessage: string | null;
  startCall: (groupId: string, type?: 'voice' | 'video') => Promise<void>;
  joinCall: (groupId: string) => Promise<void>;
  answerCall: () => Promise<void>;
  declineCall: () => void;
  leaveCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const { activeGroup } = useGroup();

  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callType, setCallType] = useState<'voice' | 'video'>('video');
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map());
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCameraOff, setIsCameraOff] = useState<boolean>(false);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // PeerConnections: socketId -> RTCPeerConnection
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceServersRef = useRef<RTCIceServer[]>([{ urls: 'stun:stun.l.google.com:19302' }]);

  // Load configured WebRTC ICE servers from server
  useEffect(() => {
    api.getWebRtcConfig()
      .then((cfg) => {
        if (cfg.iceServers && cfg.iceServers.length > 0) {
          iceServersRef.current = cfg.iceServers;
        }
      })
      .catch((e) => console.warn('Could not load server ICE config:', e));
  }, []);

  // Media acquisition helper
  const acquireMedia = async (type: 'voice' | 'video'): Promise<MediaStream> => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setIsMuted(false);
      setIsCameraOff(type === 'voice');
      return stream;
    } catch (err: any) {
      console.error('Media acquisition error:', err);
      let msg = 'Failed to access camera or microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera/Microphone permission denied. Please allow device access in browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera or microphone found on your system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Device is already in use by another application.';
      }
      setErrorMessage(msg);
      setCallStatus('failed');
      throw new Error(msg);
    }
  };

  // Helper to create RTCPeerConnection for a remote peer
  const createPeerConnection = (targetSocketId: string, stream: MediaStream): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current,
    });

    // Add local tracks to peer connection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Handle remote track received
    pc.ontrack = (event) => {
      const [remoteMediaStream] = event.streams;
      setRemoteParticipants((prev) => {
        const next = new Map(prev);
        const existing = next.get(targetSocketId);
        if (existing) {
          next.set(targetSocketId, { ...existing, stream: remoteMediaStream });
        }
        return next;
      });
    };

    // Relay ICE Candidate to remote peer
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('call:ice-candidate', {
          targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Connection state logging
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallStatus('connected');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn(`Peer connection with ${targetSocketId} transitioned to: ${pc.connectionState}`);
      }
    };

    peerConnections.current.set(targetSocketId, pc);
    return pc;
  };

  // Start Call (as Initiator)
  const startCall = async (groupId: string, type: 'voice' | 'video' = 'video') => {
    if (!socket || !isConnected) {
      setErrorMessage('Realtime server disconnected.');
      return;
    }

    try {
      setErrorMessage(null);
      setCallType(type);
      setCallStatus('connecting');
      setActiveGroupId(groupId);

      const stream = await acquireMedia(type);

      // Record call in DB and notify backend
      socket.emit('call:initiate', { groupId, callType: type }, (res: any) => {
        if (res.success) {
          setActiveCallId(res.callId);
          setCallStatus('ringing');
        } else {
          setErrorMessage(res.error || 'Failed to start call.');
          setCallStatus('failed');
        }
      });
    } catch (err: any) {
      console.error('Start call error:', err);
    }
  };

  // Join existing call
  const joinCall = async (groupId: string) => {
    if (!socket || !isConnected) return;
    try {
      setErrorMessage(null);
      setCallStatus('connecting');
      setActiveGroupId(groupId);

      const stream = await acquireMedia(callType);

      socket.emit('call:join', { groupId, isMuted, isCameraOff }, async (res: any) => {
        if (res.success) {
          setActiveCallId(res.callId);
          setCallStatus('connected');

          // Negotiate WebRTC with each existing participant
          const existingList: RemoteParticipant[] = res.participants || [];
          const map = new Map<string, RemoteParticipant>();

          for (const p of existingList) {
            map.set(p.socketId, p);
            const pc = createPeerConnection(p.socketId, stream);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('call:offer', { targetSocketId: p.socketId, offer });
          }

          setRemoteParticipants(map);
        } else {
          setErrorMessage(res.error || 'Failed to join call.');
          setCallStatus('failed');
        }
      });
    } catch (err: any) {
      console.error('Join call error:', err);
    }
  };

  // Answer Incoming Call
  const answerCall = async () => {
    if (!incomingCall) return;
    const { groupId, callType: incomingType } = incomingCall;
    setIncomingCall(null);
    setCallType(incomingType);
    await joinCall(groupId);
  };

  const declineCall = () => {
    setIncomingCall(null);
  };

  // Leave Call
  const leaveCall = useCallback(() => {
    if (socket && activeGroupId) {
      socket.emit('call:leave', { groupId: activeGroupId });
    }

    // Stop all local tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    // Close all peer connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();

    setRemoteParticipants(new Map());
    setActiveCallId(null);
    setActiveGroupId(null);
    setCallStatus('idle');
    setIsScreenSharing(false);
  }, [socket, activeGroupId, localStream]);

  // Toggle Mute
  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMuted = !audioTrack.enabled;
        setIsMuted(newMuted);
        if (socket && activeGroupId) {
          socket.emit('call:toggle-media', {
            groupId: activeGroupId,
            isMuted: newMuted,
            isCameraOff,
          });
        }
      }
    }
  };

  // Toggle Video Camera
  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        const newCameraOff = !videoTrack.enabled;
        setIsCameraOff(newCameraOff);
        if (socket && activeGroupId) {
          socket.emit('call:toggle-media', {
            groupId: activeGroupId,
            isMuted,
            isCameraOff: newCameraOff,
          });
        }
      }
    }
  };

  // Toggle Screen Share
  const toggleScreenShare = async () => {
    if (!localStream) return;
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        // Replace video track in all peer connections
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        screenTrack.onended = () => {
          toggleScreenShare(); // restore camera track when user stops sharing via browser UI
        };

        setIsScreenSharing(true);
      } else {
        // Revert back to camera track
        const userMedia = await navigator.mediaDevices.getUserMedia({ video: true });
        const cameraTrack = userMedia.getVideoTracks()[0];

        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(cameraTrack);
          }
        });

        setIsScreenSharing(false);
      }
    } catch (err) {
      console.warn('Screen share cancelled or failed:', err);
    }
  };

  // Socket signaling event listeners
  useEffect(() => {
    if (!socket) return;

    // Incoming call notification
    socket.on('call:incoming', (data: IncomingCallData) => {
      // Only show incoming modal if not already in another call
      if (callStatus === 'idle') {
        setIncomingCall(data);
      }
    });

    // When another peer joins the group call
    socket.on('call:peer-joined', ({ socketId, user: peerUser, isMuted: pMuted, isCameraOff: pCamOff }: any) => {
      setRemoteParticipants((prev) => {
        const next = new Map(prev);
        next.set(socketId, {
          socketId,
          user: peerUser,
          isMuted: pMuted,
          isCameraOff: pCamOff,
        });
        return next;
      });
      setCallStatus('connected');
    });

    // Handle incoming WebRTC Offer
    socket.on('call:offer', async ({ callerSocketId, callerUser, offer }: any) => {
      if (!localStream) return;

      const pc = createPeerConnection(callerSocketId, localStream);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('call:answer', { targetSocketId: callerSocketId, answer });

      setRemoteParticipants((prev) => {
        const next = new Map(prev);
        if (!next.has(callerSocketId)) {
          next.set(callerSocketId, {
            socketId: callerSocketId,
            user: callerUser,
            isMuted: false,
            isCameraOff: false,
          });
        }
        return next;
      });
      setCallStatus('connected');
    });

    // Handle incoming WebRTC Answer
    socket.on('call:answer', async ({ responderSocketId, answer }: any) => {
      const pc = peerConnections.current.get(responderSocketId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        setCallStatus('connected');
      }
    });

    // Handle incoming ICE Candidate
    socket.on('call:ice-candidate', async ({ senderSocketId, candidate }: any) => {
      const pc = peerConnections.current.get(senderSocketId);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      }
    });

    // Peer media toggle
    socket.on('call:peer-media-toggled', ({ socketId, isMuted: pMuted, isCameraOff: pCamOff }: any) => {
      setRemoteParticipants((prev) => {
        const next = new Map(prev);
        const p = next.get(socketId);
        if (p) {
          next.set(socketId, { ...p, isMuted: pMuted, isCameraOff: pCamOff });
        }
        return next;
      });
    });

    // Peer left call
    socket.on('call:peer-left', ({ socketId }: any) => {
      const pc = peerConnections.current.get(socketId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(socketId);
      }
      setRemoteParticipants((prev) => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    });

    // Call ended globally
    socket.on('call:ended', () => {
      leaveCall();
    });

    return () => {
      socket.off('call:incoming');
      socket.off('call:peer-joined');
      socket.off('call:offer');
      socket.off('call:answer');
      socket.off('call:ice-candidate');
      socket.off('call:peer-media-toggled');
      socket.off('call:peer-left');
      socket.off('call:ended');
    };
  }, [socket, localStream, callStatus, leaveCall]);

  return (
    <CallContext.Provider
      value={{
        callStatus,
        callType,
        activeCallId,
        activeGroupId,
        localStream,
        remoteParticipants,
        isMuted,
        isCameraOff,
        isScreenSharing,
        incomingCall,
        errorMessage,
        startCall,
        joinCall,
        answerCall,
        declineCall,
        leaveCall,
        toggleMute,
        toggleCamera,
        toggleScreenShare,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within a CallProvider');
  return context;
};
