import type { APIRoute } from 'astro';
import { getServerUser, isAdminUser } from '../../../lib/serverAuth';

let cfEnv: any = null;
try {
  const { env } = await import("cloudflare:workers");
  cfEnv = env;
} catch (e) {}

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
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

    const userhash = cfEnv?.CATBOX_USERHASH || 
      (typeof process !== "undefined" && process?.env ? process.env.CATBOX_USERHASH : undefined) ||
      "";

    // 3. Forward the file upload to Catbox.moe
    const catboxForm = new FormData();
    catboxForm.append("reqtype", "fileupload");
    if (userhash) {
      catboxForm.append("userhash", userhash);
    }
    catboxForm.append("fileToUpload", file, file.name);

    console.log(`Forwarding file "${file.name}" to Catbox...`);
    const catboxResponse = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: catboxForm
    });

    if (!catboxResponse.ok) {
      throw new Error(`Catbox API returned status ${catboxResponse.status}`);
    }

    const fileUrl = await catboxResponse.text();
    const trimmedUrl = fileUrl.trim();

    if (!trimmedUrl.startsWith("http")) {
      throw new Error(`Invalid response from Catbox: ${trimmedUrl}`);
    }

    return new Response(JSON.stringify({ success: true, url: trimmedUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("❌ File upload proxy failed:", error);
    return new Response(JSON.stringify({ error: "Upload failed" }), { status: 500 });
  }
};
