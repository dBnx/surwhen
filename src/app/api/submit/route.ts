import { NextRequest, NextResponse } from "next/server";
import { getSurveyByHash, getTargetEmail } from "~/lib/surveys";
import { sendSurveySubmissionEmail } from "~/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hash, name, email, reason } = body;

    if (!hash || !name || !reason) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const survey = getSurveyByHash(hash);
    if (!survey) {
      return NextResponse.json(
        { error: "Invalid survey hash" },
        { status: 404 },
      );
    }

    const targetEmail = getTargetEmail(survey);

    await sendSurveySubmissionEmail({
      targetEmail,
      name,
      userEmail: email,
      reason,
      surveyTitle: survey.title,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error submitting survey:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

