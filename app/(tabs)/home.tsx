import BabylonWebView from '@/components/BabylonWebView';
import SmartCamera, { EyeCentres, SmartCameraHandle } from '@/components/SmartCamera';
import React from 'react';
import {
  Button,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import io from 'socket.io-client';

export default function HomeScreen() {
  // ----- Socket.IO setup -----
  const socketRef = React.useRef(
    io('https://emoapi-7curv8t0b-michelhabibs-projects.vercel.app/', {
      transports: ['websocket'], // Ensures websocket transport for React Native
    }),
  );

  const [eyeCentres, setEyeCentres] = React.useState<EyeCentres | null>(null);
  const cameraRef = React.useRef<SmartCameraHandle>(null);
  const [snapshotUri, setSnapshotUri] = React.useState<string | null>(null);

  // ----- Chat state -----
  type ChatMessage = { id: string; user: string; text: string };
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [inputText, setInputText] = React.useState('');

  const handleSnapshot = React.useCallback((uri: string) => {
    console.log('[HomeScreen] Snapshot path:', uri);
    // Ensure file:// prefix for local files
    const finalUri = uri.startsWith('file://') ? uri : `file://${uri}`;
    setSnapshotUri(finalUri);
  }, []);

  // Handle incoming messages
  React.useEffect(() => {
    const socket = socketRef.current;

    const handleConnect = () => {
      console.log('Connected:', socket.id);
    };

    const handleTextMessage = (payload: Omit<ChatMessage, 'id'> & { id?: string }) => {
      // Normalise payload to ChatMessage shape
      const normalised: ChatMessage = {
        id: payload.id ?? Date.now().toString(),
        user: payload.user ?? 'server',
        text: payload.text,
      };
      setMessages(prev => [...prev, normalised]);
    };

    socket.on('connect', handleConnect);
    socket.on('text_message', handleTextMessage);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('text_message', handleTextMessage);
      socket.disconnect();
    };
  }, []);

  const handleSend = React.useCallback(() => {
    if (!inputText.trim()) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      user: 'me',
      text: inputText.trim(),
    };

    // Append locally
    setMessages(prev => [...prev, newMessage]);

    // Emit to server (exclude id to let server assign one if desired)
    socketRef.current.emit('text_message', { user: newMessage.user, text: newMessage.text });

    setInputText('');
  }, [inputText]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {/* Babylon scene fills the entire background */}
      <BabylonWebView eyeCentres={eyeCentres} />

      {/* Floating face-tracking camera overlay */}
      <SmartCamera
        ref={cameraRef}
        /* all props are optional – shown here for clarity */
        width={150}
        height={200}
        targetFps={5}
        performanceMode="fast"
        landmarkMode="all"
        minFaceSize={0.10}
        cameraFacing="front"
        top={400}
        right={20}
        showFace={true}
        showEyes={true}
        showMouth={false}

        onEyeCentres={setEyeCentres}
        onSnapshot={handleSnapshot}
      />

      {/* Snapshot preview */}
      {snapshotUri && (
        <Image
          source={{ uri: snapshotUri }}
          style={{ position: 'absolute', top: 120, left: 20, alignSelf: 'center', width: 120, height: 120, borderRadius: 8, borderWidth: 2, borderColor: '#fff' }}
        />
      )}

      {/* Messages list */}
      <FlatList
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
            <View style={styles.bubbleContent}>
              <Text style={styles.bubbleText}>{item.text}</Text>
            </View>
          </View>
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        style={{ flex: 1, marginTop: 80 }}
        inverted
      />

      {/* Snapshot button */}
      <View style={{ position: 'absolute', bottom: 120, alignSelf: 'center' }}>
        <Button title="Capture" onPress={() => cameraRef.current?.captureSnapshot()} />
      </View>

      {/* Chat input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inputContainer}
      >
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          style={styles.textInput}
        />
        <Button title="Send" onPress={handleSend} disabled={!inputText.trim()} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  textInput: {
    flex: 1,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginRight: 8,
  },
  bubble: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
  },
  bubbleLeft: {
    justifyContent: 'flex-start',
  },
  bubbleRight: {
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
  },
  bubbleContent: {
    maxWidth: '80%',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bubbleText: {
    color: '#fff',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
  },
}); 