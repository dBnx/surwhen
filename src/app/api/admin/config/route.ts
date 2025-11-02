import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { updateDefaultTargetEmail } from "~/lib/surveys.server";

function validateToken(request: NextRequest): boolean {
  const token = request.nextUrl.searchParams.get("token") ||
    request.headers.get("x-admin-token");
  return token === env.ADMIN_TOKEN;
}

export async function PUT(request: NextRequest) {
  if (!validateToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { defaultTargetEmail } = body;

    if (!defaultTargetEmail) {
      return NextResponse.json(
        { error: "defaultTargetEmail is required" },
        { status: 400 },
      );
    }

    await updateDefaultTargetEmail(defaultTargetEmail);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating default email:", error);
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

