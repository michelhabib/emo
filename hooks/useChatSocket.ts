import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// -----------------------------------------------------------------------------
// Types shared with ChatBox
// -----------------------------------------------------------------------------
export type ChatMessage = {
  id: string;
  user: string;
  text?: string;
  photo?: string;
};

interface MessagePayload {
  data: string;
  type: 'text' | 'photo';
  timestamp: number;
  userid: string;
}

// -----------------------------------------------------------------------------
// Demo credentials – replace with proper auth later
// -----------------------------------------------------------------------------
const USERNAME = 'misho';
const PASSWORD = 'M@$ter123';

// Helper to create payloads for outgoing messages
const createMessagePayload = (data: string, type: 'text' | 'photo'): MessagePayload => ({
  data,
  type,
  timestamp: Date.now(),
  userid: 'me', // TODO: Replace with actual user ID from auth context
});

/**
 * useChatSocket encapsulates authentication (JWT), Socket.IO connection,
 * incoming message handling and helper functions for sending text & photo
 * messages. Components using this hook can focus solely on presentation.
 *
 * @param socketUrl Backend websocket endpoint (default: http://10.0.2.2:8000/)
 */
export const useChatSocket = (socketUrl: string = 'http://10.0.2.2:8000/') => {
  // ---------------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------------
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Hold active socket instance across renders
  const socketRef = useRef<Socket | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch JWT once on mount, then establish websocket connection
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    const fetchTokenAndConnect = async () => {
      try {
        const res = await fetch(`${socketUrl}token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `username=${encodeURIComponent(USERNAME)}&password=${encodeURIComponent(
            PASSWORD,
          )}`,
        });

        if (!res.ok) {
          throw new Error(`Token request failed – ${res.status}`);
        }

        const { access_token } = await res.json();
        if (!isMounted) return; // Component might have unmounted while awaiting

        const socket = io(socketUrl, {
          transports: ['websocket'],
          auth: { token: `Bearer ${access_token}` },
        });

        socketRef.current = socket;

        const handleIncomingMessage = (payload: MessagePayload) => {
          console.log('[useChatSocket] message ⇐', payload);
          const normalised: ChatMessage = payload.type === 'photo'
            ? {
                id: Date.now().toString(),
                user: payload.userid === 'me' ? 'server' : payload.userid,
                photo: payload.data,
              }
            : {
                id: Date.now().toString(),
                user: payload.userid === 'me' ? 'server' : payload.userid,
                text: payload.data,
              };
          setMessages(prev => [...prev, normalised]);
        };

        socket.on('text_message', handleIncomingMessage);
        socket.on('photo_message', handleIncomingMessage);
        socket.on('sendPhoto', handleIncomingMessage);
        socket.on('connect_error', err => console.log('[useChatSocket] connect_error:', err));
        socket.on('disconnect', reason => console.log('[useChatSocket] disconnected:', reason));

        // Cleanup on unmount
        return () => {
          socket.off('text_message', handleIncomingMessage);
          socket.off('photo_message', handleIncomingMessage);
          socket.off('sendPhoto', handleIncomingMessage);
          socket.disconnect();
        };
      } catch (err) {
        console.error('[useChatSocket] JWT fetch error:', err);
      }
    };

    fetchTokenAndConnect();

    return () => {
      isMounted = false;
      socketRef.current?.disconnect();
    };
  }, [socketUrl]);

  // ---------------------------------------------------------------------------
  // Helper functions for sending messages to the server
  // ---------------------------------------------------------------------------
  const sendText = useCallback((text: string) => {
    if (!text.trim()) return;
    const payload = createMessagePayload(text.trim(), 'text');
    console.log('[useChatSocket] sending text ⇒', payload);
    socketRef.current?.emit('text_message', payload);

    // Optimistically add to local state
    setMessages(prev => [...prev, { id: Date.now().toString(), user: 'me', text: text.trim() }]);
  }, []);

  const sendPhoto = useCallback((base64Uri: string) => {
    const payload = createMessagePayload(base64Uri, 'photo');
    console.log('[useChatSocket] sending photo ⇒', payload);
    socketRef.current?.emit('send_photo', payload);

    // Optimistically add to local state
    setMessages(prev => [...prev, { id: Date.now().toString(), user: 'me', photo: base64Uri }]);
  }, []);

  // ---------------------------------------------------------------------------
  // Expose public API to components
  // ---------------------------------------------------------------------------
  return {
    messages,
    sendText,
    sendPhoto,
  } as const;
}; 