import type { APIRoute } from 'astro';
import { getServerUser, isAdminUser } from '../../../lib/serverAuth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    let cfEnv: any = null;
    try {
      const { env } = await import("cloudflare:workers");
      cfEnv = env;
    } catch (e) {}

    // 1. Verify session and Admin rights
    const user = await getServerUser(request, cookies);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const isAdmin = isAdminUser(user.email, cfEnv);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden. Admin access required." }), { status: 403 });
    }

    // 2. Parse uploaded file from request
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 });
    }

    const fileBuffer = await file.arrayBuffer();
    const fileName = file.name || "screenshot.webp";
    const fileBlob = new Blob([fileBuffer], { type: file.type || "image/webp" });

    const userhash = cfEnv?.CATBOX_USERHASH || 
      (typeof process !== "undefined" && process?.env ? process.env.CATBOX_USERHASH : undefined) ||
      "";

    // -------------------------------------------------------------
    // Provider 1: FreeImage.host (High-speed, permanent iili.io CDN)
    // -------------------------------------------------------------
    async function uploadToFreeImage(): Promise<string> {
      console.log(`[Upload Provider 1] Sending "${fileName}" (${(fileBuffer.byteLength / 1024).toFixed(1)} KB) to FreeImage.host...`);
      const fiForm = new FormData();
      fiForm.append("key", "6d207e02198a847aa98d0a2a901485a5");
      fiForm.append("action", "upload");
      fiForm.append("source", fileBlob, fileName);
      fiForm.append("format", "json");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const res = await fetch("https://freeimage.host/api/1/upload", {
          method: "POST",
          body: fiForm,
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (!res.ok) {
          throw new Error(`FreeImage API HTTP ${res.status}`);
        }

        const data = await res.json() as any;
        const cdnUrl = data?.image?.url || data?.image?.display_url;
        if (cdnUrl && cdnUrl.startsWith("http")) {
          return cdnUrl;
        }
        throw new Error("FreeImage response missing image URL");
      } catch (err) {
        clearTimeout(timeout);
        throw err;
      }
    }

    // -------------------------------------------------------------
    // Provider 2: Catbox.moe (Fallback if reachable)
    // -------------------------------------------------------------
    async function uploadToCatbox(): Promise<string> {
      console.log(`[Upload Provider 2] Trying Catbox.moe...`);
      const catboxForm = new FormData();
      catboxForm.append("reqtype", "fileupload");
      if (userhash) {
        catboxForm.append("userhash", userhash);
      }
      catboxForm.append("fileToUpload", fileBlob, fileName);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      try {
        const res = await fetch("https://catbox.moe/user/api.php", {
          method: "POST",
          body: catboxForm,
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`Catbox API HTTP ${res.status}`);
        const text = await res.text();
        const trimmed = text.trim();
        if (trimmed.startsWith("http")) return trimmed;
        throw new Error(`Invalid Catbox output: ${trimmed}`);
      } catch (err) {
        clearTimeout(timeout);
        throw err;
      }
    }

    const requestedProvider = (formData.get("provider") as string) || "auto";

    // Execution Chain with User Selection & Auto-Failover
    let finalUrl = "";

    if (requestedProvider === "catbox") {
      try {
        finalUrl = await uploadToCatbox();
      } catch (e) {
        console.warn("⚠️ Catbox preferred upload failed, trying FreeImage fallback:", e);
        finalUrl = await uploadToFreeImage();
      }
    } else if (requestedProvider === "freeimage") {
      try {
        finalUrl = await uploadToFreeImage();
      } catch (e) {
        console.warn("⚠️ FreeImage preferred upload failed, trying Catbox fallback:", e);
        finalUrl = await uploadToCatbox();
      }
    } else {
      // Default Auto-Select Best
      try {
        finalUrl = await uploadToFreeImage();
      } catch (e1) {
        console.warn("⚠️ FreeImage upload failed, trying Catbox fallback:", e1);
        try {
          finalUrl = await uploadToCatbox();
        } catch (e2) {
          console.error("❌ All image upload providers failed:", e2);
        }
      }
    }

    if (!finalUrl || !finalUrl.startsWith("http")) {
      return new Response(
        JSON.stringify({ error: "Failed to upload image to CDN" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`🎉 [Upload Complete] Image CDN URL: ${finalUrl}`);

    return new Response(JSON.stringify({ success: true, url: finalUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("❌ File upload proxy failed:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Upload failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
