import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  const locale = await getLocale();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center text-white">
      <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-[5rem]">
          {t("title")}
        </h1>
        <div className="flex max-w-md flex-col gap-6 rounded-2xl bg-white/15 backdrop-blur-md p-8 text-center shadow-2xl border border-white/20">
          <p className="text-xl">
            {t("message")}
          </p>
          <p className="text-lg text-white/80">
            {t("submessage")}
          </p>
          <Link
            href={`/${locale}`}
            className="mt-4 rounded-lg bg-white/25 px-6 py-3 font-medium text-white hover:bg-white/35 focus:outline-none focus:ring-2 focus:ring-white/70 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
          >
            {t("returnHome")}
          </Link>
        </div>
      </div>
    </main>
  );
}

