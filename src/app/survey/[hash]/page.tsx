"use client";

import { use, useState } from "react";
import { notFound } from "next/navigation";
import { getSurveyByHash } from "~/lib/surveys";

interface SurveyPageProps {
  params: Promise<{ hash: string }>;
}

export default function SurveyPage({ params }: SurveyPageProps) {
  const { hash } = use(params);
  const survey = getSurveyByHash(hash);

  if (!survey) {
    notFound();
  }

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

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
    } catch (error) {
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[var(--color-gradient-start)] via-[var(--color-gradient-mid)] to-[var(--color-gradient-end)] text-white">
      <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
        <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-5xl">
          {survey.title}
        </h1>
        
        <div className="flex max-w-md flex-col gap-6 rounded-2xl bg-white/15 backdrop-blur-md p-8 shadow-2xl border border-white/20">
          <p className="text-lg text-center">{survey.description}</p>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg bg-white/25 px-4 py-2 text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-white/70 focus:bg-white/30 transition-all"
                placeholder="Your name"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email (optional - for CC)
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg bg-white/25 px-4 py-2 text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-white/70 focus:bg-white/30 transition-all"
                placeholder="your.email@example.com"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="reason" className="text-sm font-medium">
                Reason <span className="text-red-400">*</span>
              </label>
              <select
                id="reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="rounded-lg bg-white/25 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/70 focus:bg-white/30 transition-all"
              >
                <option value="" className="bg-[var(--color-gradient-start)]">
                  Select a reason...
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
              {isSubmitting ? "Sending..." : "Send"}
            </button>

            {submitStatus === "success" && (
              <p className="mt-2 text-center text-green-400">
                Survey submitted successfully!
              </p>
            )}

            {submitStatus === "error" && (
              <p className="mt-2 text-center text-red-400">
                An error occurred. Please try again.
              </p>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}

