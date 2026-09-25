import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { useGroup } from './GroupContext';
import { api, User } from '../services/api';

export type CallStatus = 'idle' | 'connecting' | 'ringing' | 'connected' | 'reconnecting' | 'ended' | 'failed';

export interface RemoteParticipant {
  socketId: string;
  user: User;
  stream?: MediaStream;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing?: boolean;
}

export interface IncomingCallData {
  groupId: string;
  groupName?: string;
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
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidatesQueue = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // Helper to drain queued ICE candidates after remoteDescription is set
  const drainIceCandidates = async (targetSocketId: string, pc: RTCPeerConnection) => {
    const queue = iceCandidatesQueue.current.get(targetSocketId) || [];
    while (queue.length > 0) {
      const cand = queue.shift();
      if (cand) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('[WebRTC] Error adding queued ICE candidate:', e);
        }
      }
    }
  };

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

  // Media acquisition helper with audio fallback for headless / devices without camera
  const acquireMedia = async (type: 'voice' | 'video'): Promise<MediaStream> => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      localStreamRef.current = stream;
      setIsMuted(false);
      setIsCameraOff(type === 'voice');
      return stream;
    } catch (err: any) {
      // If video was requested but no camera hardware is present, gracefully fallback to audio
      if (type === 'video' && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
        console.warn('Camera not found, attempting audio-only fallback...');
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          setLocalStream(audioStream);
          localStreamRef.current = audioStream;
          setIsMuted(false);
          setIsCameraOff(true);
          return audioStream;
        } catch (audioErr: any) {
          // Both failed, proceed to error handler
        }
      }

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

    // Connection state logging & state machine synchronization
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${targetSocketId} connectionState: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        setCallStatus('connected');
      } else if (pc.connectionState === 'failed') {
        const anyConnected = Array.from(peerConnections.current.values()).some(
          (p) => p.connectionState === 'connected'
        );
        if (!anyConnected) {
          setErrorMessage('Peer connection failed. Direct network connectivity could not be established.');
          setCallStatus('failed');
        }
      } else if (pc.connectionState === 'disconnected') {
        setCallStatus('reconnecting');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${targetSocketId} iceConnectionState: ${pc.iceConnectionState}`);
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
          // If no existing peers, stay connecting until peers join
          if (existingList.length === 0) {
            setCallStatus('connecting');
          }
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
    if (incomingCall && socket) {
      socket.emit('call:decline', {
        groupId: incomingCall.groupId,
        callId: incomingCall.callId,
      });
    }
    setIncomingCall(null);
  };

  // Leave Call
  const leaveCall = useCallback(() => {
    if (socket && activeGroupId) {
      socket.emit('call:leave', { groupId: activeGroupId });
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    cameraTrackRef.current = null;

    // Stop all local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    // Close all peer connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    iceCandidatesQueue.current.clear();

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
            isScreenSharing,
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
            isScreenSharing,
          });
        }
      }
    }
  };

  // Stop Screen Share helper
  const stopScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    // Restore camera video track
    let cameraTrack = cameraTrackRef.current;
    if (!cameraTrack || cameraTrack.readyState === 'ended') {
      try {
        const userMedia = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        cameraTrack = userMedia.getVideoTracks()[0] || null;
      } catch (err) {
        console.warn('Could not re-acquire camera after screen sharing:', err);
        cameraTrack = null;
      }
    }
    cameraTrackRef.current = cameraTrack;

    // Restore local media stream
    const audioTracks = localStream ? localStream.getAudioTracks() : [];
    const restoredTracks = cameraTrack ? [cameraTrack, ...audioTracks] : audioTracks;
    const restoredStream = new MediaStream(restoredTracks);
    setLocalStream(restoredStream);

    // Replace track back to camera on all peer connections
    peerConnections.current.forEach(async (pc) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(cameraTrack);
      }
    });

    setIsScreenSharing(false);
    setIsCameraOff(!cameraTrack);

    if (socket && activeGroupId) {
      socket.emit('call:toggle-media', {
        groupId: activeGroupId,
        isMuted,
        isCameraOff: !cameraTrack,
        isScreenSharing: false,
      });
    }
  }, [socket, activeGroupId, isMuted, localStream]);

  // Toggle Screen Share
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setErrorMessage('Screen sharing is not supported by your browser in this environment.');
      return;
    }

    try {
      // 1. Save current camera video track before switching
      const currentCameraTrack = localStream?.getVideoTracks()[0] || null;
      cameraTrackRef.current = currentCameraTrack;

      // 2. Request screen capture from browser
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
        } as any,
        audio: false,
      });

      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) {
        throw new Error('No video track available in screen capture.');
      }
      screenStreamRef.current = screenStream;

      // 3. Assemble and set combined local stream (screen video + existing microphone audio)
      const audioTracks = localStream ? localStream.getAudioTracks() : [];
      const combinedStream = new MediaStream([screenTrack, ...audioTracks]);
      setLocalStream(combinedStream);

      // 4. Update all peer connections with the screen video track
      for (const [targetSocketId, pc] of peerConnections.current.entries()) {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          try {
            await sender.replaceTrack(screenTrack);
          } catch (e) {
            console.warn('replaceTrack failed, renegotiating offer:', e);
            pc.addTrack(screenTrack, combinedStream);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket?.emit('call:offer', { targetSocketId, offer });
          }
        } else {
          // If no video sender existed (e.g. started as voice call)
          pc.addTrack(screenTrack, combinedStream);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket?.emit('call:offer', { targetSocketId, offer });
        }
      }

      // 5. Handle native browser "Stop sharing" bar/button
      screenTrack.onended = () => {
        stopScreenShare();
      };

      // 6. Update local state and broadcast screen sharing active to peers
      setIsScreenSharing(true);
      setIsCameraOff(false);

      if (socket && activeGroupId) {
        socket.emit('call:toggle-media', {
          groupId: activeGroupId,
          isMuted,
          isCameraOff: false,
          isScreenSharing: true,
        });
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        // User clicked "Cancel" on browser screen selection picker
        console.log('Screen sharing cancelled by user.');
        return;
      }
      console.error('Screen sharing error:', err);
      setErrorMessage(err.message || 'Failed to start screen sharing.');
    }
  };

  // Socket signaling event listeners
  useEffect(() => {
    if (!socket) return;

    // Incoming call notification
    const handleIncomingCall = (data: IncomingCallData) => {
      console.log('[WebRTC] Received call:incoming:', data);
      // Only show incoming modal if not already in another call
      if (callStatus === 'idle') {
        setIncomingCall(data);
      }
    };

    // When another peer joins the group call
    const handlePeerJoined = ({ socketId, user: peerUser, isMuted: pMuted, isCameraOff: pCamOff }: any) => {
      console.log(`[WebRTC] Peer joined: ${peerUser.name} (${socketId})`);
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
    };

    // Handle incoming WebRTC Offer
    const handleOffer = async ({ callerSocketId, callerUser, offer }: any) => {
      console.log(`[WebRTC] Received call:offer from ${callerSocketId}`);
      let stream = localStreamRef.current;
      if (!stream) {
        try {
          stream = await acquireMedia(callType);
        } catch (e) {
          console.error('[WebRTC] Could not acquire media for offer response:', e);
          return;
        }
      }

      const pc = peerConnections.current.get(callerSocketId) || createPeerConnection(callerSocketId, stream);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await drainIceCandidates(callerSocketId, pc);

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
    };

    // Handle incoming WebRTC Answer
    const handleAnswer = async ({ responderSocketId, answer }: any) => {
      console.log(`[WebRTC] Received call:answer from ${responderSocketId}`);
      const pc = peerConnections.current.get(responderSocketId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await drainIceCandidates(responderSocketId, pc);
      }
    };

    // Handle incoming ICE Candidate
    const handleIceCandidate = async ({ senderSocketId, candidate }: any) => {
      const pc = peerConnections.current.get(senderSocketId);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[WebRTC] Error adding ICE candidate:', e);
        }
      } else {
        if (!iceCandidatesQueue.current.has(senderSocketId)) {
          iceCandidatesQueue.current.set(senderSocketId, []);
        }
        iceCandidatesQueue.current.get(senderSocketId)!.push(candidate);
      }
    };

    // Peer media toggle
    const handleMediaToggled = ({ socketId, isMuted: pMuted, isCameraOff: pCamOff, isScreenSharing: pScreenShare }: any) => {
      setRemoteParticipants((prev) => {
        const next = new Map(prev);
        const p = next.get(socketId);
        if (p) {
          next.set(socketId, {
            ...p,
            isMuted: pMuted !== undefined ? pMuted : p.isMuted,
            isCameraOff: pCamOff !== undefined ? pCamOff : p.isCameraOff,
            isScreenSharing: pScreenShare !== undefined ? pScreenShare : p.isScreenSharing,
          });
        }
        return next;
      });
    };

    // Peer left call
    const handlePeerLeft = ({ socketId }: any) => {
      const pc = peerConnections.current.get(socketId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(socketId);
      }
      iceCandidatesQueue.current.delete(socketId);
      setRemoteParticipants((prev) => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    };

    // Call declined by member
    const handleDeclined = ({ userName }: any) => {
      console.log(`[WebRTC] Call declined by ${userName}`);
      if (callStatus === 'ringing') {
        setErrorMessage(`${userName || 'Group member'} declined the call.`);
        setTimeout(() => {
          leaveCall();
        }, 2500);
      }
    };

    // Call ended globally
    const handleEnded = () => {
      leaveCall();
    };

    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:peer-joined', handlePeerJoined);
    socket.on('call:offer', handleOffer);
    socket.on('call:answer', handleAnswer);
    socket.on('call:ice-candidate', handleIceCandidate);
    socket.on('call:peer-media-toggled', handleMediaToggled);
    socket.on('call:peer-left', handlePeerLeft);
    socket.on('call:declined', handleDeclined);
    socket.on('call:ended', handleEnded);

    return () => {
      socket.off('call:incoming', handleIncomingCall);
      socket.off('call:peer-joined', handlePeerJoined);
      socket.off('call:offer', handleOffer);
      socket.off('call:answer', handleAnswer);
      socket.off('call:ice-candidate', handleIceCandidate);
      socket.off('call:peer-media-toggled', handleMediaToggled);
      socket.off('call:peer-left', handlePeerLeft);
      socket.off('call:declined', handleDeclined);
      socket.off('call:ended', handleEnded);
    };
  }, [socket, callStatus, callType, leaveCall]);

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
