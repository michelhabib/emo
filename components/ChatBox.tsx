import { ChatMessage, useChatSocket } from '@/hooks/useChatSocket';
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
import styles from './ChatBox.styles';

// -----------------------------------------------------------------------------
// Types & Props
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

// https://socket.io/how-to/use-with-react

/**
 * ChatBox encapsulates everything related to the realtime chat feature: socket
 * connection, message list, input box & send button. Designed as a drop-in
 * overlay similar to BabylonWebView & SmartCamera.
 */
const ChatBox: React.FC<ChatBoxProps> = ({
  style,
  // TODO: Cleartext traffic blocked on Android - make it https
  socketUrl = 'http://10.0.1.54:8000/',
  topOffset = 80,
  photoPath = '/data/data/com.anonymous.emo/cache/img.JPG',
}) => {
  // ---------------------------------------------------------------------------
  // Socket.IO – delegate to custom hook
  // ---------------------------------------------------------------------------
  const { messages, sendText, sendPhoto } = useChatSocket(socketUrl);

  // ---------------------------------------------------------------------------
  // Local state (view only)
  // ---------------------------------------------------------------------------
  const [inputText, setInputText] = React.useState('');

  // Ref to access FlatList imperative API
  const flatListRef = React.useRef<FlatList<ChatMessage>>(null);

  // ---------------------------------------------------------------------------
  // Send helper
  // ---------------------------------------------------------------------------
  const handleSend = React.useCallback(() => {
    if (!inputText.trim()) return;
    sendText(inputText.trim());
    setInputText('');
  }, [inputText, sendText]);

  // ---------------------------------------------------------------------------
  // Photo sending helper will use the `photoPath` prop.
  // ---------------------------------------------------------------------------
  const handleSendPhoto = React.useCallback(async () => {
    if (!photoPath) {
      console.warn('[ChatBox] No photoPath prop supplied – nothing to send.');
      return;
    }

    // Normalise for Expo FileSystem
    const uri =
      photoPath.startsWith('file://') ? photoPath : `file://${photoPath}`;

    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      sendPhoto(`data:image/jpeg;base64,${base64}`);
    } catch (err) {
      console.error('[ChatBox] Failed to read photo', err);
    }
  }, [photoPath, sendPhoto]);

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