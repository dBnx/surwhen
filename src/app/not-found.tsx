import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
          Invalid Invitation
        </h1>
        <div className="flex max-w-md flex-col gap-6 rounded-xl bg-white/10 p-8 text-center">
          <p className="text-xl">
            This invitation has expired or is invalid.
          </p>
          <p className="text-lg text-white/80">
            An invitation link must be used to access surveys.
          </p>
          <Link
            href="/"
            className="mt-4 rounded-lg bg-white/20 px-6 py-3 font-medium text-white hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </main>
  );
}

