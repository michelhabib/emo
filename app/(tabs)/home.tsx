import BabylonWebView from '@/components/BabylonWebView';
import SmartCamera, { EyeCentres, SmartCameraHandle } from '@/components/SmartCamera';
import React from 'react';
import { Button, Image, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const [eyeCentres, setEyeCentres] = React.useState<EyeCentres | null>(null);
  const cameraRef = React.useRef<SmartCameraHandle>(null);
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

      {/* Snapshot button */}
      <View style={{ position: 'absolute', bottom: 40, alignSelf: 'center' }}>
        <Button title="Capture" onPress={() => cameraRef.current?.captureSnapshot()} />
      </View>
    </SafeAreaView>
  );
} 