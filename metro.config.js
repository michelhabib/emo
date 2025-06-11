// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const { assetExts, sourceExts } = config.resolver;

config.resolver.assetExts = [...assetExts, 'html', 'css', 'glb', 'txt']; // ✅ keep only _true_ blobs
// leave sourceExts untouched – it already contains js, jsx, ts, tsx, …

// ensure the Expo asset hasher still runs
config.transformer.assetPlugins = ['expo-asset/tools/hashAssetFiles']; // Expo doc pattern

module.exports = config;


