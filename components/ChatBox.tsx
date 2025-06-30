import * as FileSystem from 'expo-file-system';
import React from 'react';
import {
  Button,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from 'react-native';
import { io, Socket } from 'socket.io-client';
import styles from './ChatBox.styles';

// Hard-coded demo credentials – replace with secure flow later
const USERNAME = 'misho';
const PASSWORD = 'M@$ter123';

// -----------------------------------------------------------------------------
// Types & Props
// -----------------------------------------------------------------------------

export type ChatMessage = {
  id: string;
  user: string;
  text?: string;
  photo?: string;
};

interface ChatBoxProps {
  /** Optional container style override */
  style?: object;
  /** Optional Websocket endpoint override */
  socketUrl?: string;
  /** Vertical offset for the messages list */
  topOffset?: number;
  /** Path on device for the predefined JPEG to send when user taps 📷 */
  photoPath?: string | null;
}

// Payload interface for socket emissions
interface MessagePayload {
  data: string;
  type: 'text' | 'photo';
  timestamp: number;
  userid: string;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Creates a standardized payload for socket emissions
 * @param data - The message content (text or base64 photo data)
 * @param type - The type of message ('text' or 'photo')
 * @returns Formatted payload with data, type, timestamp, and userid
 */
const createMessagePayload = (data: string, type: 'text' | 'photo'): MessagePayload => {
  return {
    data,
    type,
    timestamp: Date.now(),
    userid: 'me', // TODO: Replace with actual user ID from auth context
  };
};

// https://socket.io/how-to/use-with-react

/**
 * ChatBox encapsulates everything related to the realtime chat feature: socket
 * connection, message list, input box & send button. Designed as a drop-in
 * overlay similar to BabylonWebView & SmartCamera.
 */
const ChatBox: React.FC<ChatBoxProps> = ({
  style,
  // TODO: Cleartext traffic blocked on Android - make it https
  socketUrl = 'http://10.0.2.2:8000/',
  topOffset = 80,
  photoPath,
}) => {
  // ---------------------------------------------------------------------------
  // Socket.IO setup
  // ---------------------------------------------------------------------------
  // Will hold the active Socket.IO connection once authenticated
  const socketRef = React.useRef<Socket | null>(null);

  // ---------------------------------------------------------------------------
  // Auth state – fetch JWT on first mount
  // ---------------------------------------------------------------------------
  const [token, setToken] = React.useState<string | null>(null);

  React.useEffect(() => {


    const fetchToken = async () => {
      try {
        const res = await fetch(`${socketUrl}token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `username=${encodeURIComponent(USERNAME)}&password=${encodeURIComponent(
            PASSWORD,
          )}`,
        });

        if (!res.ok) {
          throw new Error(`Token request failed – ${res.status}`);
        }

        const json = await res.json();
        console.log('[ChatBox] Received JWT');
        setToken(json.access_token);
      } catch (err) {
        console.error('[ChatBox] JWT fetch error:', err);
      }
    };

    fetchToken();
  }, [socketUrl]);

  // ---------------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------------
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [inputText, setInputText] = React.useState('');

  // Ref to access FlatList imperative API
  const flatListRef = React.useRef<FlatList<ChatMessage>>(null);

  // ---------------------------------------------------------------------------
  // Initialise Socket.IO once we have a token
  // ---------------------------------------------------------------------------
  React.useEffect(() => {
    if (!token) return; // Wait for JWT

    const socket = io(socketUrl, {
      transports: ['websocket'],
      auth: {
        token: `Bearer ${token}`,
      },
    });

    socketRef.current = socket;

    const handleConnect = () => {
      console.log('[ChatBox] Connected:', socket.id);
    };

    const handleTextMessage = (payload: MessagePayload) => {
      console.log('[ChatBox] received message ⇐', payload);
      const normalised: ChatMessage = {
        id: Date.now().toString(),
        user: payload.userid === 'me' ? 'server' : payload.userid, 
        text: payload.data,
        photo: undefined,
      };
      setMessages(prev => [...prev, normalised]);
    };

    socket.on('connect', handleConnect);
    socket.on('text_message', handleTextMessage);
    socket.on('photo_message', handleTextMessage);
    socket.on('sendPhoto', handleTextMessage);
    socket.on('connect_error', err => {
      console.log('[ChatBox] connect_error:', err.message);
    });
    socket.on('disconnect', reason => {
      console.log('[ChatBox] disconnected:', reason);
    });
    socket.io.on('reconnect_attempt', attempt => {
      console.log('[ChatBox] reconnect attempt', attempt);
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('text_message', handleTextMessage);
      socket.off('photo_message', handleTextMessage);
      socket.off('sendPhoto', handleTextMessage);
      socket.disconnect();
    };
    // We intentionally exclude setMessages from deps to avoid re-registering
    // handlers on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, socketUrl]);

  // ---------------------------------------------------------------------------
  // Send helper
  // ---------------------------------------------------------------------------
  const handleSend = React.useCallback(() => {
    if (!inputText.trim()) return;

    const payload = createMessagePayload(inputText.trim(), 'text');
    console.log('[ChatBox] sending ⇒', payload);

    socketRef.current?.emit('text_message', payload, (ack?: string) => {
      console.log('[ChatBox] ack ⇐', ack);
    });

    // Add to local messages with the old format for display
    const localMessage = { user: 'me', text: inputText.trim(), id: Date.now().toString() };
    setMessages(p => [...p, localMessage]);
    setInputText('');
  }, [inputText]);

  // ---------------------------------------------------------------------------
  // Photo sending helper will use the `photoPath` prop.
  // ---------------------------------------------------------------------------
  const handleSendPhoto = React.useCallback(async () => {
    if (!photoPath) {
      console.warn('[ChatBox] No photoPath prop supplied – nothing to send.');
      return;
    }

    try {
      const base64 = await FileSystem.readAsStringAsync(photoPath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const base64Uri = `data:image/jpeg;base64,${base64}`;
      const payload = createMessagePayload(base64Uri, 'photo');

      console.log('[ChatBox] sending photo ⇒', payload);
      socketRef.current?.emit('send_photo', payload, (ack?: string) => {
        console.log('[ChatBox] photo ack ⇐', ack);
      });

      // Add to local messages with the old format for display
      const localMessage = { user: 'me', photo: base64Uri, id: Date.now().toString() };
      setMessages(p => [...p, localMessage]);
    } catch (err) {
      console.error('[ChatBox] Failed to read photo', err);
    }
  }, [photoPath]);

  // ---------------------------------------------------------------------------
  // Ensure we always scroll to the latest message when a new one arrives
  // ---------------------------------------------------------------------------
  React.useEffect(() => {
    if (messages.length === 0) return;
    // Delay till next frame so the list has rendered the new item
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <View style={[{ flex: 1 }, style]}>
      {/* Messages list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.user === 'me' ? styles.bubbleRight : styles.bubbleLeft,
            ]}
          >
            <Image
              source={require('@/assets/images/icon.png') /* Placeholder avatar */}
              style={styles.avatar}
            />
            <View
              style={[
                styles.bubbleContent,
                item.user === 'me' ? styles.bubbleContentMe : styles.bubbleContentOther,
              ]}
            >
              {item.photo ? (
                <Image source={{ uri: item.photo }} style={styles.sentPhoto} />
              ) : (
                <Text style={styles.bubbleText}>{item.text}</Text>
              )}
            </View>
          </View>
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
        style={{ flex: 1, marginTop: topOffset }}
      />

      {/* Chat input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inputContainer}
      >
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          style={styles.textInput}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        {/* Action buttons */}
        <View style={{ marginLeft: 4 }}>
          <Button title="📷" onPress={handleSendPhoto} />
        </View>
        <View style={{ marginLeft: 4 }}>
          <Button title="Send" onPress={handleSend} disabled={!inputText.trim()} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default ChatBox; 