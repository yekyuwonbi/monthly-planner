import type { SupabaseClient } from "@supabase/supabase-js";

export type PlannerRemoteRow = {
  user_id: string;
  planner_state: unknown;
  updated_at: string;
};

const TABLE_NAME = "planner_profiles";

export async function fetchRemotePlannerState(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from(TABLE_NAME)
    .select("planner_state, updated_at")
    .eq("user_id", userId)
    .maybeSingle<PlannerRemoteRow>();

  if (error) throw error;
  return data;
}

export async function saveRemotePlannerState(client: SupabaseClient, userId: string, plannerState: unknown, updatedAt: number) {
  const { error } = await client.from(TABLE_NAME).upsert(
    {
      user_id: userId,
      planner_state: plannerState,
      updated_at: new Date(updatedAt).toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}
