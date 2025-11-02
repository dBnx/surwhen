export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
          Survey Access
        </h1>
        <div className="flex max-w-md flex-col gap-4 rounded-xl bg-white/10 p-8 text-center">
          <p className="text-xl">
            An invitation link must be used to access surveys.
          </p>
        </div>
      </div>
    </main>
  );
}
