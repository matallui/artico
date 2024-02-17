import { PeerConsole } from "./demo";

export default function PeerPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-20">
      <h1 className="text-4xl">Peer Demo</h1>
      <div className="flex flex-col lg:flex-row gap-4 p-4">
        <PeerConsole className="flex-1 sm:w-[490px]" name="A" initiator />
        <PeerConsole className="flex-1 sm:w-[490px]" name="B" />
      </div>
    </div>
  );
}
