import { RoomDemo } from "./demo";

export default function RoomIdPage({ params }: { params: { roomId: string } }) {
  return (
    <div className="w-screen h-screen overflow-hidden">
      <RoomDemo roomId={params.roomId} />
    </div>
  );
}
