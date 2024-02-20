export default function RoomIdPage({ params }: { params: { roomId: string } }) {
  return <h1>Room ID: {params.roomId}</h1>;
}
