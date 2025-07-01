import BabylonWebView from '@/components/BabylonWebView';
import ChatBox from '@/components/ChatBox';
import SmartCamera, { EyeCentres } from '@/components/SmartCamera';
import React from 'react';
import {
  Image,
  StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
//        

export default function HomeScreen() {
  const [eyeCentres, setEyeCentres] = React.useState<EyeCentres | null>(null);
  const [snapshotUri, setSnapshotUri] = React.useState<string | null>(null);

  const handleSnapshot = React.useCallback((uri: string) => {
    console.log('[HomeScreen] Snapshot path:', uri);
    // Ensure file:// prefix for local files
    const finalUri = uri.startsWith('file://') ? uri : `file://${uri}`;
    setSnapshotUri(finalUri);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {/* Babylon scene fills the entire background */}
      <BabylonWebView eyeCentres={eyeCentres} style={styles.webview} />

      {/* Floating face-tracking camera overlay */}
      <SmartCamera
        /* all props are optional – shown here for clarity */
        width={75}
        height={100}
        targetFps={10}
        performanceMode="fast"
        landmarkMode="all"
        minFaceSize={0.10}
        cameraFacing="front"
        top={50}
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

      {/* Chat overlay */}
      <ChatBox style={{ flex: 1 }} photoPath={snapshotUri} />

      {/* Camera controls are now embedded inside SmartCamera */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  webview: {
    position: 'absolute',
    top: 0,
    // right: 80,
    width: 450,
    height: 700,
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
}); 