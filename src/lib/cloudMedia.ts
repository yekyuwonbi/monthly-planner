import type { SupabaseClient } from "@supabase/supabase-js";

export const PLANNER_MEDIA_BUCKET = "planner-backgrounds";

function getFileExtension(fileName: string, fallbackType: "image" | "video") {
  const cleaned = fileName.split("?")[0];
  const ext = cleaned.includes(".") ? cleaned.split(".").pop() || "" : "";
  if (ext) return ext.toLowerCase();
  return fallbackType === "video" ? "mp4" : "png";
}

export function buildCloudMediaPath(userId: string, fileName: string, uploadedMediaType: "image" | "video") {
  const extension = getFileExtension(fileName, uploadedMediaType);
  return `${userId}/planner-background.${extension}`;
}

export async function uploadPlannerBackground(
  client: SupabaseClient,
  userId: string,
  file: File,
  uploadedMediaType: "image" | "video",
  previousPath?: string,
) {
  const path = buildCloudMediaPath(userId, file.name, uploadedMediaType);

  if (previousPath && previousPath !== path) {
    await client.storage.from(PLANNER_MEDIA_BUCKET).remove([previousPath]);
  }

  const { error } = await client.storage.from(PLANNER_MEDIA_BUCKET).upload(path, file, {
    upsert: true,
    cacheControl: "3600",
    contentType: file.type || (uploadedMediaType === "video" ? "video/mp4" : "image/png"),
  });

  if (error) throw error;

  const { data } = client.storage.from(PLANNER_MEDIA_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export async function removePlannerBackground(client: SupabaseClient, path: string) {
  if (!path) return;
  const { error } = await client.storage.from(PLANNER_MEDIA_BUCKET).remove([path]);
  if (error) throw error;
}
