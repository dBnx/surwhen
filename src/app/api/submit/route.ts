import { type NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import {
  getSurveyByHashFromFile,
  getTargetEmailFromFile,
} from "~/lib/surveys.server";
import { sendSurveySubmissionEmail } from "~/lib/email";
import { locales, defaultLocale, type Locale } from "~/i18n/config";
import { isValidEmail } from "~/lib/surveys";

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

    // Input length constraints
    const MAX_NAME_LENGTH = 200;
    const MAX_REASON_LENGTH = 1000;
    const MAX_EMAIL_LENGTH = 254; // RFC 5321

    // Required fields validation
    if (!hash || !name || !reason) {
      return NextResponse.json(
        { error: t("missingFields") },
        { status: 400 },
      );
    }

    // Length validation
    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: t("nameTooLong") },
        { status: 400 },
      );
    }

    if (reason.length > MAX_REASON_LENGTH) {
      return NextResponse.json(
        { error: t("reasonTooLong") },
        { status: 400 },
      );
    }

    // Email validation
    if (email) {
      if (email.length > MAX_EMAIL_LENGTH) {
        return NextResponse.json(
          { error: t("emailTooLong") },
          { status: 400 },
        );
      }

      if (!isValidEmail(email)) {
        return NextResponse.json(
          { error: t("invalidEmailFormat") },
          { status: 400 },
        );
      }
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
      surveyDescription: survey.description,
      locale,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error submitting survey:", error);

    // Use default locale for internal errors
    const t = await getTranslations({ locale: defaultLocale, namespace: "errors" });

    if (error instanceof Error) {
      // SMTP/Email errors
      if (
        error.message.includes("SMTP") ||
        error.message.includes("email") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("EAUTH")
      ) {
        return NextResponse.json(
          { error: t("emailDeliveryError") },
          { status: 503 }, // Service Unavailable
        );
      }

      // Timeout errors
      if (
        error.message.includes("timeout") ||
        error.message.includes("ETIMEDOUT")
      ) {
        return NextResponse.json(
          { error: t("requestTimeout") },
          { status: 504 }, // Gateway Timeout
        );
      }
    }

    // Generic fallback
    return NextResponse.json(
      { error: t("internalServerError") },
      { status: 500 },
    );
  }
}

