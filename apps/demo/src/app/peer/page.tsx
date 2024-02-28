import { PeerConsole } from "./demo";

export default function PeerPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-20">
      <h1 className="text-2xl sm:text-4xl">Peer Demo</h1>
      <div className="flex flex-col items-center lg:flex-row lg:items-start gap-4 p-1 sm:p-4">
        <PeerConsole
          className="max-w-[95%] flex-1 sm:w-[490px]"
          name="A"
          initiator
        />
        <PeerConsole className="max-w-[95%] sm:w-[490px]" name="B" />
      </div>
    </div>
  );
}
