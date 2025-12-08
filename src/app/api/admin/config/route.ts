import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import {
  updateDefaultTargetEmail,
  updateAccentColor,
  getSurveysConfigFromFile,
  saveSurveysConfig,
  mergeSurveysConfig,
} from "~/lib/surveys.server";
import type { SurveysConfig, Survey } from "~/lib/surveys";
import { validateSurvey } from "~/lib/surveys";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function validateToken(request: NextRequest): boolean {
  const token =
    request.nextUrl.searchParams.get("token") ??
    request.headers.get("x-admin-token");
  return token === env.ADMIN_TOKEN;
}

interface ConfigRequestBody {
  defaultTargetEmail?: string;
  accentColor?: string;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  if (!validateToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await getSurveysConfigFromFile();
    const jsonString = JSON.stringify(config, null, 2);

    return new NextResponse(jsonString, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="surveys.json"',
        "Cache-Control": "no-store",
        "CDN-Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error("Error downloading config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

function validateConfig(config: unknown): {
  valid: boolean;
  error?: string;
} {
  if (typeof config !== "object" || config === null) {
    return { valid: false, error: "Config must be an object" };
  }

  const c = config as Record<string, unknown>;

  if (typeof c.defaultTargetEmail !== "string") {
    return {
      valid: false,
      error: "defaultTargetEmail is required and must be a string",
    };
  }

  if (c.accentColor !== undefined && typeof c.accentColor !== "string") {
    return {
      valid: false,
      error: "accentColor must be a string if provided",
    };
  }

  if (!Array.isArray(c.surveys)) {
    return {
      valid: false,
      error: "surveys is required and must be an array",
    };
  }

  for (let i = 0; i < c.surveys.length; i++) {
    const survey = c.surveys[i] as unknown;
    if (!survey || typeof survey !== "object") {
      return {
        valid: false,
        error: `Survey at index ${i} is invalid`,
      };
    }

    const validation = validateSurvey(survey as Partial<Survey>);
    if (!validation.valid) {
      return {
        valid: false,
        error: `Survey at index ${i}: ${validation.errors.join(", ")}`,
      };
    }
  }

  return { valid: true };
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  if (!validateToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 },
      );
    }

    const strategy = (formData.get("strategy") as string | null) ?? "replace";
    const conflictPreference = (formData.get("conflictPreference") as
      | "source"
      | "existing"
      | null) ?? "source";

    if (strategy !== "replace" && strategy !== "merge") {
      return NextResponse.json(
        { error: "Invalid strategy. Must be 'replace' or 'merge'" },
        { status: 400 },
      );
    }

    if (strategy === "merge" && conflictPreference !== "source" && conflictPreference !== "existing") {
      return NextResponse.json(
        { error: "Invalid conflictPreference. Must be 'source' or 'existing'" },
        { status: 400 },
      );
    }

    const fileContent = await file.text();
    let parsedConfig: unknown;

    try {
      parsedConfig = JSON.parse(fileContent);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON format" },
        { status: 400 },
      );
    }

    const validation = validateConfig(parsedConfig);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error ?? "Invalid config format" },
        { status: 400 },
      );
    }

    const uploadedConfig = parsedConfig as SurveysConfig;

    if (strategy === "replace") {
      // Replace: use uploaded config completely
      await saveSurveysConfig(uploadedConfig);
    } else {
      // Merge: combine configs
      const mergedConfig = await mergeSurveysConfig(
        uploadedConfig,
        conflictPreference,
      );
      await saveSurveysConfig(mergedConfig);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error uploading config:", error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
): Promise<NextResponse> {
  if (!validateToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ConfigRequestBody;
    const { defaultTargetEmail, accentColor } = body;

    if (defaultTargetEmail !== undefined) {
      await updateDefaultTargetEmail(defaultTargetEmail);
    }

    if (accentColor !== undefined) {
      await updateAccentColor(accentColor);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error updating config:", error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

