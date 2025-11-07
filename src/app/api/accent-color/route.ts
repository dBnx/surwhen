import { type NextRequest, NextResponse } from "next/server";
import { getSurveysConfigFromFile } from "~/lib/surveys.server";

const DEFAULT_ACCENT_COLOR = "#2563eb";

function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/i.test(color);
}

export async function GET(
  _request: NextRequest,
): Promise<NextResponse> {
  try {
    const config = await getSurveysConfigFromFile();
    let accentColor = config.accentColor ?? DEFAULT_ACCENT_COLOR;
    
    if (!isValidHexColor(accentColor)) {
      accentColor = DEFAULT_ACCENT_COLOR;
    }
    
    return NextResponse.json(
      { accentColor },
      {
        headers: {
          "Cache-Control": "public, s-maxage=0, must-revalidate",
        },
      },
    );
  } catch (error: unknown) {
    console.error("Error fetching accent color:", error);
    return NextResponse.json(
      { accentColor: DEFAULT_ACCENT_COLOR },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=0, must-revalidate",
        },
      },
    );
  }
}

