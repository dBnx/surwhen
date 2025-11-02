import { type NextRequest, NextResponse } from "next/server";
import { getSurveyByHashFromFile } from "~/lib/surveys.server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
): Promise<NextResponse> {
  try {
    const { hash } = await params;
    const survey = await getSurveyByHashFromFile(hash);

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    return NextResponse.json(survey);
  } catch (error: unknown) {
    console.error("Error fetching survey:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

