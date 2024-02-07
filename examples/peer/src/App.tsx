import { PeerConsole } from "@/components/peer-console";

function App() {
  return (
    <div className="min-h-[100vh] bg-background text-foreground dark flex flex-col items-center gap-4 py-20">
      <h1 className="text-4xl">Peer Example</h1>
      <div className="flex flex-col gap-4">
        <PeerConsole name="A" />
        <PeerConsole name="B" />
      </div>
    </div>
  );
}

export default App;
