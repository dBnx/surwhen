import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getTranslations } from "next-intl/server";
import { escape } from "html-escaper";
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

// Singleton transporter with connection pooling
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
      pool: true, // Enable connection pooling
      maxConnections: 5, // Max concurrent connections
      maxMessages: 100, // Max messages per connection
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 5000, // 5 seconds
      socketTimeout: 15000, // 15 seconds
    });
  }
  return transporter;
}

export async function sendSurveySubmissionEmail(
  submission: EmailSubmission,
): Promise<void> {
  const tEmail = await getTranslations({ locale: submission.locale, namespace: "email" });
  const tSurvey = await getTranslations({ locale: submission.locale, namespace: "survey" });

  const transporter = getTransporter();

  const greeting = tEmail("greeting");
  const thankYouMessage = tEmail("thankYouMessage");
  const surveyDescriptionLabel = tEmail("surveyDescription");
  const submissionDetailsLabel = tEmail("submissionDetails");
  const closing = tEmail("closing");

  const textBody = `
${greeting}

${thankYouMessage}

${surveyDescriptionLabel}:
${submission.surveyDescription}

${submissionDetailsLabel}:
${tSurvey("name")}: ${submission.name}
${submission.userEmail ? `${tSurvey("emailLabel")}: ${submission.userEmail}` : ""}
${tSurvey("reason")}: ${submission.reason}

${closing}
  `.trim();

  // HTML body with XSS protection using html-escaper
  const htmlBody = `
    <p>${escape(greeting)}</p>
    <p>${escape(thankYouMessage)}</p>
    <p><strong>${escape(surveyDescriptionLabel)}:</strong><br>${escape(submission.surveyDescription)}</p>
    <p><strong>${escape(submissionDetailsLabel)}:</strong></p>
    <ul>
      <li><strong>${escape(tSurvey("name"))}:</strong> ${escape(submission.name)}</li>
      ${submission.userEmail ? `<li><strong>${escape(tSurvey("emailLabel"))}:</strong> ${escape(submission.userEmail)}</li>` : ""}
      <li><strong>${escape(tSurvey("reason"))}:</strong> ${escape(submission.reason)}</li>
    </ul>
    <p>${escape(closing)}</p>
  `;

  const mailOptions = {
    from: env.SMTP_FROM,
    to: env.SMTP_FROM,
    ...(submission.userEmail && { cc: submission.userEmail }),
    bcc: submission.targetEmail,
    subject: `SurWhen: ${submission.surveyTitle} - ${submission.name}`,
    text: textBody,
    html: htmlBody,
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully:", {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      surveyTitle: submission.surveyTitle,
      targetEmail: submission.targetEmail,
      timestamp: new Date().toISOString(),
    });

    if (info.rejected.length > 0) {
      throw new Error(
        `Email rejected by server: ${info.rejected.map(String).join(", ")}`,
      );
    }
  } catch (error) {
    console.error("❌ Failed to send email:", {
      error: error instanceof Error ? error.message : String(error),
      targetEmail: submission.targetEmail,
      surveyTitle: submission.surveyTitle,
      timestamp: new Date().toISOString(),
    });

    throw new Error("Failed to send email notification");
  }
}
