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
    const { title, purchaseLinks, country } = body;

    if (!id || !title || !Array.isArray(purchaseLinks)) {
      return NextResponse.json(
        { error: "Missing required parameters: id, title, purchaseLinks" },
        { status: 400 }
      );
    }

    let targetCountry = country;
    if (!targetCountry || targetCountry === "detect") {
      const geoHeaders = [
        "x-vercel-ip-country",
        "x-country",
        "x-nf-country-code",
        "cf-ipcountry",
        "cloudfront-viewer-country"
      ];
      for (const h of geoHeaders) {
        const val = request.headers.get(h);
        if (val && val.length === 2) {
          targetCountry = val.toUpperCase();
          break;
        }
      }
      if (!targetCountry) {
        targetCountry = "US"; // default fallback
      }
    }

    const deals = await lazyGetPrices(id, title, purchaseLinks, targetCountry);
    return NextResponse.json({ deals, country: targetCountry });
  } catch (error) {
    console.error(`[Pricing API Error] Failed to fetch prices for game:`, error);
    return NextResponse.json(
      { error: "Internal server error while fetching prices" },
      { status: 500 }
    );
  }
}
