module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    'react-native-worklets-core/plugin',
    [
      'react-native-reanimated/plugin',
      {
        processNestedWorklets: true,
      },
    ],   // Reanimated must stay last
  ],
};