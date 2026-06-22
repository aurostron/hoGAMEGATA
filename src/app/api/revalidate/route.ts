import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.REVALIDATION_SECRET;

  // Guard the endpoint with a secret token (bypass check in dev if secret is not set)
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { slug } = body;

    if (!slug) {
      return NextResponse.json({ error: "Missing game slug" }, { status: 400 });
    }

    // Rebuild the specific game page cache instantly
    revalidatePath(`/game/${slug}`);
    
    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err) {
    console.error("Revalidation failed:", err);
    return NextResponse.json({ error: "Revalidation failed" }, { status: 500 });
  }
}
