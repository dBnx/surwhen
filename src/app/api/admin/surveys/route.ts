import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import {
  getAllSurveysWithHashes,
  getSurveysConfig,
  validateSurvey,
  type Survey,
} from "~/lib/surveys";
import {
  addSurvey,
  updateSurvey,
  deleteSurvey,
} from "~/lib/surveys.server";

function validateToken(request: NextRequest): boolean {
  const token = request.nextUrl.searchParams.get("token") ||
    request.headers.get("x-admin-token");
  return token === env.ADMIN_TOKEN;
}

export async function GET(request: NextRequest) {
  if (!validateToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = getSurveysConfig();
    const surveys = getAllSurveysWithHashes();
    
    return NextResponse.json({
      defaultTargetEmail: config.defaultTargetEmail,
      surveys,
    });
  } catch (error) {
    console.error("Error fetching surveys:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!validateToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const survey: Survey = {
      title: body.title,
      description: body.description,
      reasons: body.reasons,
      targetEmail: body.targetEmail || undefined,
    };

    const validation = validateSurvey(survey);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", errors: validation.errors },
        { status: 400 },
      );
    }

    await addSurvey(survey);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error adding survey:", error);
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

export async function PUT(request: NextRequest) {
  if (!validateToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { hash, ...updates } = body;

    if (!hash) {
      return NextResponse.json(
        { error: "Hash is required" },
        { status: 400 },
      );
    }

    // Convert null targetEmail to undefined to properly clear it
    if (updates.targetEmail === null) {
      updates.targetEmail = undefined;
    }

    const validation = validateSurvey(updates);
    if (!validation.valid && Object.keys(updates).length > 0) {
      return NextResponse.json(
        { error: "Validation failed", errors: validation.errors },
        { status: 400 },
      );
    }

    await updateSurvey(hash, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating survey:", error);
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

export async function DELETE(request: NextRequest) {
  if (!validateToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get("hash");

    if (!hash) {
      return NextResponse.json(
        { error: "Hash is required" },
        { status: 400 },
      );
    }

    await deleteSurvey(hash);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting survey:", error);
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

