import { polyfillWebCrypto } from "expo-standard-web-crypto";
import { registerGlobals } from "react-native-webrtc";

polyfillWebCrypto();
registerGlobals();
