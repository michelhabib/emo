module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    'expo-router/babel',
    'react-native-worklets-core/plugin',
    'react-native-reanimated/plugin',   // Reanimated must stay last
  ],
};