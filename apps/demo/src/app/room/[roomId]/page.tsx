import { RoomDemo } from "./demo";

export default function RoomIdPage({
  params,
  searchParams,
}: {
  params: { roomId: string };
  searchParams: { username: string };
}) {
  return (
    <div className="w-screen h-screen overflow-hidden">
      <RoomDemo roomId={params.roomId} username={searchParams.username} />
    </div>
  );
}
