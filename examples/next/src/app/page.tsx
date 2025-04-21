import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@rtco/ui/components/button";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center gap-8 p-24">
      <Image src="/logo.png" alt="Artico logo" width={100} height={100} />
      <h1 className="text-4xl font-bold">Artico Demos</h1>
      <Link
        href="/peer"
        className={buttonVariants({ variant: "secondary", size: "lg" })}
      >
        Peer Demo
      </Link>
      <Link
        href="/call"
        className={buttonVariants({ variant: "secondary", size: "lg" })}
      >
        Call Demo
      </Link>
      <Link
        href="/room"
        className={buttonVariants({ variant: "secondary", size: "lg" })}
      >
        Room Demo
      </Link>
    </main>
  );
}
