import { NextRequest, NextResponse } from "next/server";

// Proxy route for fetching GLB files from cross-origin URLs (e.g. Supabase signed URLs).
// Required because COEP: require-corp blocks cross-origin fetch unless the response includes
// Cross-Origin-Resource-Policy, which Supabase Storage does not send by default.
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: `Upstream ${res.status}` }, { status: 502 });
  }

  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "model/gltf-binary",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
}
