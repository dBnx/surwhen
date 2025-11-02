"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { locales, type Locale } from "~/i18n/config";

export default function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const switchLocale = (newLocale: Locale) => {
    // Set cookie for locale preference
    document.cookie = `locale=${newLocale}; path=/; max-age=31536000`; // 1 year

    // Update the URL to use the new locale
    const segments = pathname.split("/").filter(Boolean);
    
    // Remove current locale if present
    if (segments.length > 0 && locales.includes(segments[0] as Locale)) {
      segments.shift();
    }
    
    // Add new locale prefix
    const newPath = segments.length > 0 
      ? `/${newLocale}/${segments.join("/")}`
      : `/${newLocale}`;
    
    // Preserve search parameters (e.g., token for admin page)
    const queryString = searchParams.toString();
    const newUrl = queryString ? `${newPath}?${queryString}` : newPath;
    
    router.push(newUrl);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      {locales.map((loc) => (
        <button
          key={loc}
          onClick={() => switchLocale(loc)}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            locale === loc
              ? "bg-white/25 text-white shadow-lg"
              : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
          }`}
          aria-label={`Switch to ${loc === "en" ? "English" : "Deutsch"}`}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

