::: info
An example Expo app can be found [here](https://github.com/matallui/artico/tree/main/examples/expo).
:::

# Using Artico in an Expo App

Artico can be used in an Expo app by using the [@config-plugins/react-native-webrtc](https://github.com/expo/config-plugins/tree/main/packages/react-native-webrtc) plugin.
Here's a minimal set of steps to get started:

### Create a new Expo app

::: code-group

```sh [npm]
npx create-expo-app my-app
```

```sh [yarn]
yarn create expo-app my-app
```

```sh [pnpm]
pnpm create expo-app my-app
```

```sh [bun]
bun create expo-app my-app
```

:::

### Install dependencies


```sh
npx expo install @config-plugins/react-native-webrtc react-native-webrtc expo-clipboard expo-crypto expo-standard-web-crypto @rtco/client
```

::: warning
Please refer to the [@config-plugins/react-native-webrtc](https://github.com/expo/config-plugins/tree/main/packages/react-native-webrtc) documentation for more information on how to install and configure `react-native-webrtc` with Expo.
:::

### Add the plugin to your app

```js [app.json]
{
  "expo": {
    "plugins": [
      "expo-router",
      "@config-plugins/react-native-webrtc"
    ]
  }
}
```

### Add polyfills

```ts [polyfills.ts]
import { polyfillWebCrypto } from "expo-standard-web-crypto";
import { registerGlobals } from "react-native-webrtc";

polyfillWebCrypto();
registerGlobals();
```

```js [index.js]
import "./polyfills";
import "expo-router/entry";
```

Make sure to update the `main` field in your `package.json` to point to the new `index.js` file.

```json [package.json]
{
  "main": "./index"
}
```

### Use Artico in your app

```ts [app.tsx]
import { Artico } from "@rtco/client";

// ...
```

### Run your app

::: code-group

```sh [android]
npx expo run:android
```

```sh [ios]
npx expo run:ios
```
:::

