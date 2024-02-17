import { Button } from "~/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-24 gap-8 relative">
      <h1 className="text-4xl font-bold">Artico Demos</h1>
      <Button variant="secondary" size="lg">
        <Link href="/peer">Peer Demo</Link>
      </Button>
      <Button variant="secondary" size="lg">
        <Link href="/call">Call Demo</Link>
      </Button>
      <Button variant="secondary" size="lg">
        <Link href="/room">Room Demo</Link>
      </Button>
    </main>
  );
}
