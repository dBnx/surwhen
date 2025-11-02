import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { locales, defaultLocale, type Locale } from "./config";

async function getLocaleFromHeader(): Promise<Locale> {
  const headersList = await headers();
  const acceptLanguage = headersList.get("accept-language");

  if (!acceptLanguage) {
    return defaultLocale;
  }

  // Parse Accept-Language header
  const languages = acceptLanguage
    .split(",")
    .map((lang: string) => {
      const [code = "", q = "q=1"] = lang.trim().split(";");
      const quality = parseFloat(q.replace("q=", "")) || 1;
      return { code: code.toLowerCase().split("-")[0], quality };
    })
    .sort((a: { code?: string; quality: number }, b: { code?: string; quality: number }) => b.quality - a.quality);

  // Find first supported locale
  for (const { code } of languages) {
    if (code === "de") return "de";
    if (code === "en") return "en";
  }

  return defaultLocale;
}

async function getLocaleFromCookie(): Promise<Locale | null> {
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale");

  if (locale?.value && locales.includes(locale.value as Locale)) {
    return locale.value as Locale;
  }

  return null;
}

export default getRequestConfig(async ({ requestLocale }: { requestLocale: Promise<string | undefined> }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that a valid locale is used
  if (!locale || !locales.includes(locale as Locale)) {
    // Check cookie preference
    const cookieLocale = await getLocaleFromCookie();
    if (cookieLocale) {
      locale = cookieLocale;
    } else {
      // Fall back to browser language or default
      locale = await getLocaleFromHeader();
    }
  }

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  // dynamic import returns unknown; validate shape at runtime and narrow types
  const importedUnknown = (await import(`./messages/${locale}.json`)) as unknown;
  if (!importedUnknown || typeof importedUnknown !== "object") {
    throw new Error("Invalid messages file");
  }

  // Safely extract default export
  const maybeDefault = (importedUnknown as { default?: unknown }).default;
  if (!maybeDefault || typeof maybeDefault !== "object") {
    throw new Error("Invalid messages file format");
  }

  const messages = maybeDefault as Record<string, string>;

  return {
    locale,
    messages,
  };
});

