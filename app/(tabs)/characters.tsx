import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Frame, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
// import { Camera, Face, FaceDetectionOptions } from 'react-native-vision-camera-face-detector';
import { WebView } from 'react-native-webview';

export default function CharactersScreen() {
  /** ----------------------------------------------------------
   * 1️⃣  All hooks must be called before any conditional returns
   * --------------------------------------------------------- */
  const [uri, setUri] = useState<string | null>(null);
  const [uriJS, setUriJS] = useState<string | null>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  const frameProcessor = useFrameProcessor((frame: Frame) => {
    'worklet'; // enable worklet mode
    // Here you can process the frame, e.g. detect faces
    const faces = detectFaces(frame)
    console.log(`Faces in Frame: ${faces}`)
    // console.log('Frame received:', frame.toString());
  }, []);

  /** ----------------------------------------------------------
   * 2️⃣  Effects
   * --------------------------------------------------------- */
  useEffect(() => {
    (async () => {
      const [htmlAsset, cssAsset, jsAsset, glbAsset] = await Promise.all([
        Asset.fromModule(require('../../assets/babylon/babylon.html')).downloadAsync(),
        Asset.fromModule(require('../../assets/babylon/babylon_style.css')).downloadAsync(),
        Asset.fromModule(require('../../assets/babylon/script.txt')).downloadAsync(),
        Asset.fromModule(require('../../assets/babylon/jammo.glb')).downloadAsync(),
      ]);

      // 1️⃣ Read the raw HTML
      let raw = await FileSystem.readAsStringAsync(htmlAsset.localUri!);

      // 2️⃣ Replace relative paths with absolute file:// URIs
      raw = raw
        .replace('href="babylon.css"', `href="${cssAsset.localUri}"`)
        .replace('src="script.js"', `src="${jsAsset.localUri}"`)
        .replace('"jammo.glb"', `"${glbAsset.localUri}"`);
      // 3️⃣ Write out a temp HTML file you can point WebView at
      const tempFile = FileSystem.documentDirectory + 'babylon_temp.html';
      await FileSystem.writeAsStringAsync(tempFile, raw);

      setUri(tempFile);
    })();
  }, []);

  // Request camera permission on mount
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  /** ----------------------------------------------------------
   * 2️⃣  WEB build: keep your iframe tester
   * --------------------------------------------------------- */
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.webview}>
          <iframe
            src="https://www.babylonjs.com/Demos/Yeti/"
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Characters"
          />
        </View>
      </SafeAreaView>
    );
  }

  /** ----------------------------------------------------------
   * 3️⃣  Native build: point WebView at the local file URI
   * --------------------------------------------------------- */
  if (!uri) return null; // (optional) splash / loader while we resolve the file

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ uri }}                 // same for iOS & Android 🎉
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs // lets Babylon fetch .css / .js / .glb
        mixedContentMode="always" 
        javaScriptEnabled
        domStorageEnabled
        style={styles.webview}
        startInLoadingState
        onError={({ nativeEvent }) => {
          console.error('WebView JS error:', nativeEvent);
          // maybe show a fallback or retry
        }}
        onHttpError={({ nativeEvent }) => {
          console.error('WebView HTTP failure:', nativeEvent.statusCode, nativeEvent.description);
        }}   
      />
      
      {/* Camera overlay */}
      {hasPermission && device && (
        <View style={styles.cameraContainer}>
          <Camera
            style={StyleSheet.absoluteFill}
            isActive={true}
            device={device}
            frameProcessor={frameProcessor}
            frameProcessorFps={3}
          /> 
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  cameraContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 150,
    height: 200,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  camera: {
    flex: 1,
  },
});

