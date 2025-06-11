import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';


export default function CharactersScreen() {
  /** ----------------------------------------------------------
   * 1️⃣  Expo / native: resolve the bundled index.html once
   * --------------------------------------------------------- */
  const [uri, setUri] = useState<string | null>(null);
  const [uriJS, setUriJS] = useState<string | null>(null);

useEffect(() => {
  (async () => {
    const [htmlAsset, cssAsset, jsAsset, glbAsset] = await Promise.all([
      Asset.fromModule(require('../../assets/babylon/babylon.html')).downloadAsync(),
      Asset.fromModule(require('../../assets/babylon/babylon.css')).downloadAsync(),
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
    console.log('Resolved HTML:', raw);
    // 3️⃣ Write out a temp HTML file you can point WebView at
    const tempFile = FileSystem.documentDirectory + 'babylon_temp.html';
    await FileSystem.writeAsStringAsync(tempFile, raw);

    setUri(tempFile);
  })();
}, []);

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
        allowUniversalAccessFromFileURLs // lets Babylon fetch .css / .js / .glb :contentReference[oaicite:2]{index=2}
        mixedContentMode="always" 
        javaScriptEnabled
        domStorageEnabled
        style={styles.webview}
        startInLoadingState
        /* ...props from step 1... */
        onError={({ nativeEvent }) => {
          console.error('WebView JS error:', nativeEvent);
          // maybe show a fallback or retry
        }}
        onHttpError={({ nativeEvent }) => {
          console.error('WebView HTTP failure:', nativeEvent.statusCode, nativeEvent.description);
        }}   
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview:   { flex: 1 },
});
