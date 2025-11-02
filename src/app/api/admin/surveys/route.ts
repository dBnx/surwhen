import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import {
  validateSurvey,
  type Survey,
  generateHashFromTitle,
} from "~/lib/surveys";
import {
  addSurvey,
  updateSurvey,
  deleteSurvey,
  getSurveysConfigFromFile,
} from "~/lib/surveys.server";

function validateToken(request: NextRequest): boolean {
  const token =
    request.nextUrl.searchParams.get("token") ??
    request.headers.get("x-admin-token");
  return token === env.ADMIN_TOKEN;
}

interface PostSurveyRequestBody {
  title: string;
  description: string;
  reasons: string[];
  targetEmail?: string;
}

interface PutSurveyRequestBody {
  hash: string;
  title?: string;
  description?: string;
  reasons?: string[];
  targetEmail?: string | null;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  if (!validateToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await getSurveysConfigFromFile();
    const surveys = config.surveys.map((survey) => ({
      ...survey,
      hash: generateHashFromTitle(survey.title),
    }));

    return NextResponse.json({
      defaultTargetEmail: config.defaultTargetEmail,
      surveys,
    });
  } catch (error: unknown) {
    console.error("Error fetching surveys:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  if (!validateToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as PostSurveyRequestBody;
    const survey: Survey = {
      title: body.title,
      description: body.description,
      reasons: body.reasons,
      targetEmail: body.targetEmail ?? undefined,
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
  } catch (error: unknown) {
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

export async function PUT(
  request: NextRequest,
): Promise<NextResponse> {
  if (!validateToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as PutSurveyRequestBody;
    const { hash, ...updates } = body;

    if (!hash) {
      return NextResponse.json(
        { error: "Hash is required" },
        { status: 400 },
      );
    }

    // Convert null targetEmail to undefined to properly clear it
    const processedUpdates: Partial<Survey> = {};
    if (updates.title !== undefined) processedUpdates.title = updates.title;
    if (updates.description !== undefined) processedUpdates.description = updates.description;
    if (updates.reasons !== undefined) processedUpdates.reasons = updates.reasons;
    if (updates.targetEmail === null) {
      // Explicitly set to undefined to clear it
      processedUpdates.targetEmail = undefined;
    } else if (updates.targetEmail !== undefined) {
      processedUpdates.targetEmail = updates.targetEmail;
    }

    const validation = validateSurvey(processedUpdates);
    if (!validation.valid && Object.keys(updates).length > 0) {
      return NextResponse.json(
        { error: "Validation failed", errors: validation.errors },
        { status: 400 },
      );
    }

    await updateSurvey(hash, processedUpdates);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
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

export async function DELETE(
  request: NextRequest,
): Promise<NextResponse> {
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
  } catch (error: unknown) {
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

