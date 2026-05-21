import { NextRequest, NextResponse } from "next/server";
import { lazyGetPrices } from "@/lib/priceEngine";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, purchaseLinks } = body;

    if (!id || !title || !Array.isArray(purchaseLinks)) {
      return NextResponse.json(
        { error: "Missing required parameters: id, title, purchaseLinks" },
        { status: 400 }
      );
    }

    const deals = await lazyGetPrices(id, title, purchaseLinks);
    return NextResponse.json({ deals });
  } catch (error) {
    console.error(`[Pricing API Error] Failed to fetch prices for game:`, error);
    return NextResponse.json(
      { error: "Internal server error while fetching prices" },
      { status: 500 }
    );
  }
}
