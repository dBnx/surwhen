"use client";

import { useEffect } from "react";

export default function LocaleSetter({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.setAttribute("lang", locale);
  }, [locale]);

  return null;
}

