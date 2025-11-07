import nodemailer from "nodemailer";
import { getTranslations } from "next-intl/server";
import { env } from "~/env";
import type { Locale } from "~/i18n/config";

export interface EmailSubmission {
  targetEmail: string;
  name: string;
  userEmail?: string;
  reason: string;
  surveyTitle: string;
  surveyDescription: string;
  locale: Locale;
}

export async function sendSurveySubmissionEmail(
  submission: EmailSubmission,
): Promise<void> {
  const tEmail = await getTranslations({ locale: submission.locale, namespace: "email" });
  const tSurvey = await getTranslations({ locale: submission.locale, namespace: "survey" });

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  });

  const selectedOptionText = tEmail("selectedOption", { option: submission.reason });
  const greeting = tEmail("greeting");
  const surveyDescriptionLabel = tEmail("surveyDescription");
  const submissionDetailsLabel = tEmail("submissionDetails");
  const closing = tEmail("closing");

  const textBody = `
${greeting}

${selectedOptionText}

${surveyDescriptionLabel}:
${submission.surveyDescription}

${submissionDetailsLabel}:
${tSurvey("name")}: ${submission.name}
${submission.userEmail ? `${tSurvey("emailLabel")}: ${submission.userEmail}` : ""}
${tSurvey("reason")}: ${submission.reason}

${closing}
  `.trim();

  const htmlBody = `
    <p>${greeting}</p>
    <p>${selectedOptionText}</p>
    <p><strong>${surveyDescriptionLabel}:</strong><br>${submission.surveyDescription}</p>
    <p><strong>${submissionDetailsLabel}:</strong></p>
    <ul>
      <li><strong>${tSurvey("name")}:</strong> ${submission.name}</li>
      ${submission.userEmail ? `<li><strong>${tSurvey("emailLabel")}:</strong> ${submission.userEmail}</li>` : ""}
      <li><strong>${tSurvey("reason")}:</strong> ${submission.reason}</li>
    </ul>
    <p>${closing}</p>
  `;

  const mailOptions = {
    from: env.SMTP_FROM,
    to: env.SMTP_FROM,
    ...(submission.userEmail && { cc: submission.userEmail }),
    bcc: submission.targetEmail,
    subject: `SurWhen: ${submission.surveyTitle}`,
    text: textBody,
    html: htmlBody,
  };

  await transporter.sendMail(mailOptions);
}

