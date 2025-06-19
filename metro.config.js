// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const {
  resolver: { sourceExts, assetExts },
} = getDefaultConfig(__dirname);


config.resolver.assetExts = [...assetExts, 'html', 'css', 'glb', 'txt']; // ✅ keep only _true_ blobs

config.transformer.assetPlugins = ['expo-asset/tools/hashAssetFiles']; // Expo doc pattern


module.exports = config;

// // Learn more https://docs.expo.io/guides/customizing-metro
// const { getDefaultConfig } = require('expo/metro-config');

// /** @type {import('expo/metro-config').MetroConfig} */
// const config = getDefaultConfig(__dirname);

// const {
//   resolver: { sourceExts, assetExts },
// } = getDefaultConfig(__dirname);

// // config.resolver.assetExts = [...assetExts, 'html', 'css', 'glb', 'txt']; // ✅ keep only _true_ blobs

// // config.transformer.assetPlugins = ['expo-asset/tools/hashAssetFiles']; // Expo doc pattern

// config.transformer = {
//   getTransformOptions: async () => ({
//     transform: {
//       experimentalImportSupport: false,
//       inlineRequires: true,
//     },
//   }),
// };

// config.resolver = {
//   assetExts: assetExts.filter(ext => ext !== 'svg'),
//   sourceExts: [...sourceExts, 'svg'],
// };

// module.exports = config;
