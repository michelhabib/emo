import BabylonWebView from '@/components/BabylonWebView';
import ChatBox from '@/components/ChatBox';
import SmartCamera, { EyeCentres, SmartCameraHandle } from '@/components/SmartCamera';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
//        

export default function HomeScreen() {
  const [eyeCentres, setEyeCentres] = React.useState<EyeCentres | null>(null);
  const [snapshotUri, setSnapshotUri] = React.useState<string | null>(null);

  // Ref to access SmartCamera imperative API
  const smartCameraRef = React.useRef<SmartCameraHandle>(null);

  // Toggle visibility of BabylonWebView & SmartCamera
  const [showOverlay, setShowOverlay] = React.useState(true);

  const handleSnapshot = React.useCallback((uri: string) => {
    console.log('[HomeScreen] Snapshot path:', uri);
    // Ensure file:// prefix for local files
    const finalUri = uri.startsWith('file://') ? uri : `file://${uri}`;
    setSnapshotUri(finalUri);
  }, []);

  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      {/* Chat overlay – placed first so it sits at the back of the z-stack */}
      <ChatBox
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        topOffset={insets.top}
        photoPath={snapshotUri}
      />

      {/* Babylon scene fills the remaining area above the chat input */}
      {/* Reserve ~100px at the bottom (input + tab bar) so WebView doesn't block taps */}
      {showOverlay && (
        <BabylonWebView
          eyeCentres={eyeCentres}
          style={[styles.webview, { bottom: 100 }]}
        />
      )}

      {/* Floating face-tracking camera overlay */}
      {showOverlay && (
        <SmartCamera
          ref={smartCameraRef}
          /* all props are optional – shown here for clarity */
          width={50}
          height={80}
          targetFps={10}
          performanceMode="fast"
          landmarkMode="all"
          minFaceSize={0.10}
          cameraFacing="front"
          top={50}
          right={50}
          showFace={true}
          showEyes={true}
          showMouth={false}

          onEyeCentres={setEyeCentres}
          onSnapshot={handleSnapshot}
        />
      )}

      {/* Snapshot preview – hidden when overlays are hidden */}
      {showOverlay && snapshotUri && (
        <Image
          source={{ uri: snapshotUri }}
          style={{ position: 'absolute', top: 120, left: 20, alignSelf: 'center', width: 120, height: 120, borderRadius: 8, borderWidth: 2, borderColor: '#fff' }}
        />
      )}

      {/* --- Global control row ------------------------------------------------ */}
      <View style={styles.controlsRow} pointerEvents="box-none">
        {/* Face-only snapshot */}
        <Pressable
          style={styles.controlButton}
          onPress={() => smartCameraRef.current?.captureSnapshot()}
        >
          <Ionicons name="camera-outline" size={24} color="#fff" />
        </Pressable>

        {/* Full-frame snapshot */}
        <Pressable
          style={styles.controlButton}
          onPress={() => smartCameraRef.current?.captureAllSnapshot()}
        >
          <Ionicons name="scan-outline" size={24} color="#fff" />
        </Pressable>

        {/* Switch front/back camera */}
        <Pressable
          style={styles.controlButton}
          onPress={() => smartCameraRef.current?.switchCamera()}
        >
          <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
        </Pressable>

        {/* Toggle overlay visibility */}
        <Pressable
          style={styles.controlButton}
          onPress={() => setShowOverlay((prev) => !prev)}
        >
          <Ionicons name={showOverlay ? 'eye-off-outline' : 'eye-outline'} size={24} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  webview: {
    position: 'absolute',
    top: 0,
    right: 100,
    width: 200,
    height: 150,
    flex: 0,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
    backgroundColor: 'transparent'
  },
  controlsRow: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1002,
  },
  controlButton: {
    marginHorizontal: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 