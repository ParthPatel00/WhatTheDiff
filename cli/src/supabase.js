"use strict";

const { createClient } = require("@supabase/supabase-js");
const { randomUUID } = require("crypto");

const SIGNED_URL_TTL = 3600; // 1 hour

function getClient() {
  const projectId = process.env.SUPABASE_PROJECT_ID;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET_NAME ?? "GLB";

  if (!projectId || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_PROJECT_ID or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Make sure those are set in the .env file at the repo root."
    );
  }

  const url = `https://${projectId}.supabase.co`;
  return { client: createClient(url, serviceKey), bucket };
}

// Uploads both versions of a GLB file and returns 1-hour signed URLs.
// filePath is used only to derive a human-readable name prefix.
async function uploadGlb(filePath, oldBuf, newBuf) {
  const { client, bucket } = getClient();
  const uuid = randomUUID();
  const base = require("path")
    .basename(filePath, ".glb")
    .replace(/[^a-zA-Z0-9_-]/g, "_");

  const pathA = `diffs/${uuid}/${base}_before.glb`;
  const pathB = `diffs/${uuid}/${base}_after.glb`;

  const [resA, resB] = await Promise.all([
    client.storage.from(bucket).upload(pathA, oldBuf, {
      contentType: "model/gltf-binary",
      upsert: false,
    }),
    client.storage.from(bucket).upload(pathB, newBuf, {
      contentType: "model/gltf-binary",
      upsert: false,
    }),
  ]);

  if (resA.error) throw new Error(`Upload failed (before): ${resA.error.message}`);
  if (resB.error) throw new Error(`Upload failed (after): ${resB.error.message}`);

  const [signA, signB] = await Promise.all([
    client.storage.from(bucket).createSignedUrl(pathA, SIGNED_URL_TTL),
    client.storage.from(bucket).createSignedUrl(pathB, SIGNED_URL_TTL),
  ]);

  if (signA.error) throw new Error(`Sign failed (before): ${signA.error.message}`);
  if (signB.error) throw new Error(`Sign failed (after): ${signB.error.message}`);

  return {
    urlA: signA.data.signedUrl,
    urlB: signB.data.signedUrl,
    nameA: `${base}_before.glb`,
    nameB: `${base}_after.glb`,
  };
}

module.exports = { uploadGlb };
