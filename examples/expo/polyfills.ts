import { registerGlobals } from "react-native-webrtc";
import { polyfillWebCrypto } from "expo-standard-web-crypto";

polyfillWebCrypto();
registerGlobals();
