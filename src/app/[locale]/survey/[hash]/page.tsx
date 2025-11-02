"use client";

import { use, useState, useEffect } from "react";
import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Survey } from "~/lib/surveys";

// Simple Tooltip Component
function Tooltip({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="group relative inline-flex items-center">
      {children}
      <span className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 pointer-events-none z-10">
        {text}
        <span className="absolute left-1/2 top-full -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></span>
      </span>
    </div>
  );
}

interface SurveyPageProps {
  params: Promise<{ hash: string }>;
}

export default function SurveyPage({ params }: SurveyPageProps) {
  const { hash } = use(params);
  const t = useTranslations("survey");
  const tCommon = useTranslations("common");

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    async function fetchSurvey() {
      try {
        const response = await fetch(`/api/surveys/${hash}`);
        if (response.status === 404) {
          setError(true);
          return;
        }
        if (!response.ok) {
          setError(true);
          return;
        }
        const surveyData = (await response.json()) as Survey;
        setSurvey(surveyData);
      } catch (err) {
        console.error("Error fetching survey:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    void fetchSurvey();
  }, [hash]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-white">
        <p>{tCommon("loading")}</p>
      </main>
    );
  }

  if (error || !survey) {
    notFound();
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hash,
          name,
          email: email || undefined,
          reason,
        }),
      });

      if (response.ok) {
        setSubmitStatus("success");
        setName("");
        setEmail("");
        setReason("");
      } else {
        setSubmitStatus("error");
      }
    } catch {
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center text-white min-h-screen">
      <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16 w-full">
        <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-5xl">
          {survey.title}
        </h1>
        
        <div className="flex max-w-md flex-col gap-6 rounded-2xl bg-white/15 backdrop-blur-md p-8 shadow-2xl border border-white/20">
          <p className="text-lg text-center">{survey.description}</p>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="text-sm font-medium flex items-center gap-1.5">
                {t("name")} <span className="text-red-400">*</span>
                <Tooltip text={t("nameTooltip")}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-white/60 hover:text-white/80 cursor-help"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </Tooltip>
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg bg-white/25 px-4 py-2 text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-white/70 focus:bg-white/30 transition-all"
                placeholder={t("namePlaceholder")}
                maxLength={1000}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium flex items-center gap-1.5">
                {t("emailLabel")}
                <span className="text-xs font-normal text-white/50">{tCommon("optional")}</span>
                <Tooltip text={t("emailTooltip")}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-white/60 hover:text-white/80 cursor-help"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </Tooltip>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg bg-white/25 px-4 py-2 text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-white/70 focus:bg-white/30 transition-all"
                placeholder={t("emailPlaceholder")}
                maxLength={500}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="reason" className="text-sm font-medium flex items-center gap-1.5">
                {t("reason")} <span className="text-red-400">*</span>
                <Tooltip text={t("reasonTooltip")}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-white/60 hover:text-white/80 cursor-help"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </Tooltip>
              </label>
              <select
                id="reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="rounded-lg bg-white/25 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/70 focus:bg-white/30 transition-all"
              >
                <option value="" className="bg-[var(--color-gradient-start)]">
                  {t("reasonSelectPlaceholder")}
                </option>
                {survey.reasons.map((r) => (
                  <option key={r} value={r} className="bg-[var(--color-gradient-start)]">
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-4 rounded-lg bg-white/25 px-6 py-3 font-medium text-white hover:bg-white/35 focus:outline-none focus:ring-2 focus:ring-white/70 disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSubmitting ? tCommon("sending") : tCommon("send")}
            </button>

            {submitStatus === "success" && (
              <p className="mt-2 text-center text-green-400">
                {t("submitSuccess")}
              </p>
            )}

            {submitStatus === "error" && (
              <p className="mt-2 text-center text-red-400">
                {t("submitError")}
              </p>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}

