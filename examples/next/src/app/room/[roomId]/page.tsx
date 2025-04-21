import { RoomDemo } from "./demo";

export default async function RoomIdPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ username: string }>;
}) {
  const _params = await params;
  const _searchParams = await searchParams;
  return (
    <div className="h-screen w-screen overflow-hidden">
      <RoomDemo roomId={_params.roomId} username={_searchParams.username} />
    </div>
  );
}
