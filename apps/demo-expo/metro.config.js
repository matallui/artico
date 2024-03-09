// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const resolveFrom = require("resolve-from");
const path = require("path");

/** @type {import('expo/metro-config').MetroConfig} */
const defaultConfig = getDefaultConfig(__dirname);

const config = withMonorepoPaths(
  withEventTargetShim(
    withNativeWind(defaultConfig, { input: "./styles/global.css" }),
  ),
);
module.exports = config;

/**
 * Add the monorepo paths to the Metro config.
 * This allows Metro to resolve modules from the monorepo.
 *
 * @see https://docs.expo.dev/guides/monorepos/#modify-the-metro-config
 * @param {import('expo/metro-config').MetroConfig} config
 * @returns {import('expo/metro-config').MetroConfig}
 */
function withMonorepoPaths(config) {
  const projectRoot = __dirname;
  const workspaceRoot = path.resolve(projectRoot, "../..");

  // #1 - Watch all files in the monorepo
  config.watchFolders = [workspaceRoot];

  // #2 - Resolve modules within the project's `node_modules` first, then all monorepo modules
  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
  ];

  return config;
}

/**
 * Need this for react-native-webrtc to work with Expo SDK 50
 * @see https://github.com/expo/config-plugins/tree/main/packages/react-native-webrtc#event-target-shim
 * @param {import('expo/metro-config').MetroConfig} config
 * @returns {import('expo/metro-config').MetroConfig}
 */
function withEventTargetShim(config) {
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (
      // If the bundle is resolving "event-target-shim" from a module that is part of "react-native-webrtc".
      moduleName.startsWith("event-target-shim") &&
      context.originModulePath.includes("react-native-webrtc")
    ) {
      // Resolve event-target-shim relative to the react-native-webrtc package to use v6.
      // React Native requires v5 which is not compatible with react-native-webrtc.
      const eventTargetShimPath = resolveFrom(
        context.originModulePath,
        moduleName,
      );

      return {
        filePath: eventTargetShimPath,
        type: "sourceFile",
      };
    }
    // Ensure you call the default resolver.
    return context.resolveRequest(context, moduleName, platform);
  };
  return config;
}
