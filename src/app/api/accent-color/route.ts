import { type NextRequest, NextResponse } from "next/server";
import { getSurveysConfigFromFile } from "~/lib/surveys.server";

const DEFAULT_ACCENT_COLOR = "#2563eb";

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    const config = await getSurveysConfigFromFile();
    const accentColor = config.accentColor ?? DEFAULT_ACCENT_COLOR;
    return NextResponse.json({ accentColor });
  } catch (error: unknown) {
    console.error("Error fetching accent color:", error);
    return NextResponse.json(
      { accentColor: DEFAULT_ACCENT_COLOR },
      { status: 200 },
    );
  }
}

