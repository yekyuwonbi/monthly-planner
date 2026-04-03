import type { SupabaseClient } from "@supabase/supabase-js";

export const PLANNER_MEDIA_BUCKET = "planner-backgrounds";

function getFileExtension(fileName: string, mimeType: string | undefined, fallbackType: "image" | "video") {
  const normalizedMimeType = String(mimeType || "").toLowerCase();
  if (normalizedMimeType.includes("gif")) return "gif";
  if (normalizedMimeType.includes("webp")) return "webp";
  if (normalizedMimeType.includes("jpeg") || normalizedMimeType.includes("jpg")) return "jpg";
  if (normalizedMimeType.includes("avif")) return "avif";
  const cleaned = fileName.split("?")[0];
  const ext = cleaned.includes(".") ? cleaned.split(".").pop() || "" : "";
  if (ext) return ext.toLowerCase();
  return fallbackType === "video" ? "mp4" : "png";
}

export function buildCloudMediaPath(userId: string, assetId: string, fileName: string, mimeType: string | undefined, uploadedMediaType: "image" | "video") {
  const extension = getFileExtension(fileName, mimeType, uploadedMediaType);
  return `${userId}/backgrounds/${assetId}.${extension}`;
}

export function getPlannerBackgroundPublicUrl(client: SupabaseClient, path: string) {
  if (!path) return "";
  const { data } = client.storage.from(PLANNER_MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadPlannerBackground(
  client: SupabaseClient,
  userId: string,
  file: File,
  uploadedMediaType: "image" | "video",
  previousPath?: string,
  assetId?: string,
) {
  const path = buildCloudMediaPath(userId, assetId || "planner-background", file.name, file.type, uploadedMediaType);

  if (previousPath && previousPath !== path) {
    await client.storage.from(PLANNER_MEDIA_BUCKET).remove([previousPath]);
  }

  const { error } = await client.storage.from(PLANNER_MEDIA_BUCKET).upload(path, file, {
    upsert: true,
    cacheControl: "3600",
    contentType: file.type || (uploadedMediaType === "video" ? "video/mp4" : "image/png"),
  });

  if (error) throw error;

  return { path, publicUrl: getPlannerBackgroundPublicUrl(client, path) };
}

export async function removePlannerBackground(client: SupabaseClient, path: string) {
  if (!path) return;
  const { error } = await client.storage.from(PLANNER_MEDIA_BUCKET).remove([path]);
  if (error) throw error;
}
