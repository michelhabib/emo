import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { EyeCentres } from './SmartCamera';

interface BabylonWebViewProps {
  /** Optional style override for the underlying WebView */
  style?: object;

  /** Latest eye-centre positions (normalised), forwarded from SmartCamera */
  eyeCentres?: EyeCentres | null;

  /** Forward WebView onError */
  onError?: (event: any) => void;
  /** Forward WebView onHttpError */
  onHttpError?: (event: any) => void;
}

/**
 * Encapsulates everything required to download & patch Babylon assets
 * and present them inside a React-Native WebView (native platforms only).
 *
 * Usage:
 *   <BabylonWebView style={{ flex: 1 }} />
 */
const BabylonWebView: React.FC<BabylonWebViewProps> = ({ style, eyeCentres, onError, onHttpError }) => {
  const [uri, setUri] = useState<string | null>(null);
  const webRef = React.useRef<WebView>(null);
  const lastSentRef = React.useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });

  // Combine left & right eyes -> centre point and send to WebView
  useEffect(() => {
    if (!eyeCentres || !webRef.current) return;

    const points = [] as { xPct: number; yPct: number }[];
    if (eyeCentres.left) points.push(eyeCentres.left);
    if (eyeCentres.right) points.push(eyeCentres.right);
    if (points.length === 0) return;

    const avgX = points.reduce((s, p) => s + p.xPct, 0) / points.length;
    const avgY = points.reduce((s, p) => s + p.yPct, 0) / points.length;

    // Throttle: only forward if moved >1% or >60 ms passed
    const now = Date.now();
    const MIN_INTERVAL = 60; // ms ≈16 fps
    const MIN_DELTA = 0.01;  // 1% change

    const last = lastSentRef.current;
    if (
      Math.abs(avgX - last.x) < MIN_DELTA &&
      Math.abs(avgY - last.y) < MIN_DELTA &&
      now - last.time < MIN_INTERVAL
    ) {
      return;
    }

    lastSentRef.current = { x: avgX, y: avgY, time: now };

    const payload = JSON.stringify({ type: 'eyePosition', xPct: avgX, yPct: avgY });

    // Send to WebView
    // @ts-ignore postMessage exists on WebView ref (RN) – types lag behind
    webRef.current.postMessage(payload);
  }, [eyeCentres]);

  useEffect(() => {
    // Skip entirely when running on the web — caller may render fallback UI instead.
    if (Platform.OS === 'web') return;

    (async () => {
      // Ensure the four required assets are present on the device & get file:// URIs
      const [htmlAsset, cssAsset, jsAsset, glbAsset] = await Promise.all([
        Asset.fromModule(require('../assets/babylon/babylon.html')).downloadAsync(),
        Asset.fromModule(require('../assets/babylon/babylon_style.css')).downloadAsync(),
        Asset.fromModule(require('../assets/babylon/script.txt')).downloadAsync(),
        Asset.fromModule(require('../assets/babylon/jammo1.3.glb')).downloadAsync(),
      ]);

      // 1️⃣ Read the raw HTML
      let raw = await FileSystem.readAsStringAsync(htmlAsset.localUri!);

      // 2️⃣ Patch relative paths → absolute file:// URIs so Babylon can load them
      raw = raw
        .replace('href="babylon.css"', `href="${cssAsset.localUri}"`)
        .replace('src="script.js"', `src="${jsAsset.localUri}"`)
        .replace('"jammo.glb"', `"${glbAsset.localUri}"`);

      // 3️⃣ Write a temporary HTML file that the WebView can load
      const tempFile = FileSystem.documentDirectory + 'babylon_temp.html';
      await FileSystem.writeAsStringAsync(tempFile, raw);

      setUri(tempFile);
    })();
  }, []);

  // Native splash / loader while assets resolve
  if (Platform.OS === 'web' || !uri) return null;

  return (
    <WebView
      ref={webRef}
      originWhitelist={['*']}
      source={{ uri }}
      allowFileAccess
      allowFileAccessFromFileURLs
      allowUniversalAccessFromFileURLs
      mixedContentMode="always"
      javaScriptEnabled
      domStorageEnabled
      style={styles.webview}
      startInLoadingState
      onError={onError}
      onHttpError={onHttpError}
    />
  );
};

const styles = StyleSheet.create({
  webview: {
    position: 'absolute',
    top: 200,
    right: 80,
    width: 250,
    height: 500,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
});

export default BabylonWebView; 