// Adds a build number to app.json so every APK can install over the last one.
// CI sets BUILD_NUMBER to the GitHub Actions run number.
module.exports = ({ config }) => {
  const build = Number(process.env.BUILD_NUMBER || 1);
  return {
    ...config,
    version: `1.0.${build}`,
    android: { ...config.android, versionCode: build },
  };
};
