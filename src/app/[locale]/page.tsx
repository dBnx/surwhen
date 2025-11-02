import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[var(--color-gradient-start)] via-[var(--color-gradient-mid)] to-[var(--color-gradient-end)] text-white">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-[5rem]">
          {t("title")}
        </h1>
        <div className="flex max-w-md flex-col gap-4 rounded-2xl bg-white/15 backdrop-blur-md p-8 text-center shadow-2xl border border-white/20">
          <p className="text-xl">
            {t("message")}
          </p>
        </div>
      </div>
    </main>
  );
}
