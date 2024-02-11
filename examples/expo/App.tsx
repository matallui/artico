import { PeerConsole } from "./components/peer-console";
import { StatusBar } from "expo-status-bar";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-black/90">
        <ScrollView>
          <View className="flex-1 items-center space-y-4">
            <Text className="text-white text-3xl mt-1">Peer Example</Text>
            <PeerConsole className="w-[95%]" name="A" initiator />
            <PeerConsole className="w-[95%]" name="B" />
          </View>
        </ScrollView>
      </SafeAreaView>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
