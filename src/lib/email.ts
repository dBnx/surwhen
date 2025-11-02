import nodemailer from "nodemailer";
import { env } from "~/env";

export interface EmailSubmission {
  targetEmail: string;
  name: string;
  userEmail?: string;
  reason: string;
  surveyTitle: string;
}

export async function sendSurveySubmissionEmail(
  submission: EmailSubmission,
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  });

  const mailOptions = {
    from: env.SMTP_FROM,
    to: submission.targetEmail,
    ...(submission.userEmail && { cc: submission.userEmail }),
    subject: `Survey Submission: ${submission.surveyTitle}`,
    text: `
Survey Submission

Survey: ${submission.surveyTitle}
Name: ${submission.name}
${submission.userEmail ? `Email: ${submission.userEmail}` : ""}
Reason: ${submission.reason}
    `.trim(),
    html: `
      <h2>Survey Submission</h2>
      <p><strong>Survey:</strong> ${submission.surveyTitle}</p>
      <p><strong>Name:</strong> ${submission.name}</p>
      ${submission.userEmail ? `<p><strong>Email:</strong> ${submission.userEmail}</p>` : ""}
      <p><strong>Reason:</strong> ${submission.reason}</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

