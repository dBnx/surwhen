import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { locales, defaultLocale, type Locale } from "./config";

function getLocaleFromHeader(): Locale {
  const headersList = headers();
  const acceptLanguage = headersList.get("accept-language");
  
  if (!acceptLanguage) {
    return defaultLocale;
  }

  // Parse Accept-Language header
  const languages = acceptLanguage
    .split(",")
    .map((lang) => {
      const [code, q = "q=1"] = lang.trim().split(";");
      const quality = parseFloat(q.replace("q=", "")) || 1;
      return { code: code.toLowerCase().split("-")[0], quality };
    })
    .sort((a, b) => b.quality - a.quality);

  // Find first supported locale
  for (const { code } of languages) {
    if (code === "de" || code === "en") {
      return code as Locale;
    }
  }

  return defaultLocale;
}

function getLocaleFromCookie(): Locale | null {
  const cookieStore = cookies();
  const locale = cookieStore.get("locale");
  
  if (locale?.value && locales.includes(locale.value as Locale)) {
    return locale.value as Locale;
  }
  
  return null;
}

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that a valid locale is used
  if (!locale || !locales.includes(locale as Locale)) {
    // Check cookie preference
    const cookieLocale = getLocaleFromCookie();
    if (cookieLocale) {
      locale = cookieLocale;
    } else {
      // Fall back to browser language or default
      locale = getLocaleFromHeader();
    }
  }

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});

