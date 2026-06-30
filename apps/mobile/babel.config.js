module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4: 워크릿 플러그인은 반드시 마지막
    plugins: ['react-native-worklets/plugin'],
  };
};
