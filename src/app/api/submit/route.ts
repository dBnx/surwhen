import { type NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { generateHashFromTitle } from "~/lib/surveys";
import {
  getSurveyByHashFromFile,
  getTargetEmailFromFile,
} from "~/lib/surveys.server";
import { sendSurveySubmissionEmail } from "~/lib/email";
import { locales, defaultLocale, type Locale } from "~/i18n/config";

interface SubmitRequestBody {
  hash: string;
  name: string;
  email?: string;
  reason: string;
}

function getLocaleFromRequest(request: NextRequest): Locale {
  const acceptLanguage = request.headers.get("accept-language");

  if (!acceptLanguage) {
    return defaultLocale;
  }

  // Parse Accept-Language header
  const languages = acceptLanguage
    .split(",")
    .map((lang) => {
      const [code = "", q = "q=1"] = lang.trim().split(";");
      const quality = parseFloat(q.replace("q=", "")) || 1;
      return { code: code.toLowerCase().split("-")[0], quality };
    })
    .sort((a: { code?: string; quality: number }, b: { code?: string; quality: number }) => b.quality - a.quality);

  // Find first supported locale
  for (const { code } of languages) {
    if (locales.includes(code as Locale)) {
      return code as Locale;
    }
  }

  return defaultLocale;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    const locale = getLocaleFromRequest(request);
    const t = await getTranslations({ locale, namespace: "errors" });

    const body = (await request.json()) as SubmitRequestBody;
    const { hash, name, email, reason } = body;

    if (!hash || !name || !reason) {
      return NextResponse.json(
        { error: t("missingFields") },
        { status: 400 },
      );
    }

    const survey = await getSurveyByHashFromFile(hash);
    if (!survey) {
      return NextResponse.json(
        { error: t("invalidSurveyHash") },
        { status: 404 },
      );
    }

    const targetEmail = await getTargetEmailFromFile(survey);

    await sendSurveySubmissionEmail({
      targetEmail,
      name,
      userEmail: email,
      reason,
      surveyTitle: survey.title,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error submitting survey:", error);
    // Use default locale for internal errors
    const t = await getTranslations({ locale: defaultLocale, namespace: "errors" });
    return NextResponse.json(
      { error: t("internalServerError") },
      { status: 500 },
    );
  }
}

