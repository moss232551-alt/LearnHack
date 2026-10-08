import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: 30_000,
  });
}

export function useProfile() {
  const { data: user } = useSession();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useIsAdmin() {
  const { data: user } = useSession();
  return useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).some((r) => r.role === "admin");
    },
  });
}

export function useSubjects() {
  return useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*").order("name_en");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

/** Awards points to the signed-in learner and keeps the pet stage in sync. */
export async function awardPoints(userId: string, points: number, focusMinutes = 0) {
  const { data: p } = await supabase
    .from("profiles")
    .select("points, focus_minutes")
    .eq("id", userId)
    .maybeSingle();
  const nextMinutes = (p?.focus_minutes ?? 0) + focusMinutes;
  await supabase
    .from("profiles")
    .update({
      points: (p?.points ?? 0) + points,
      focus_minutes: nextMinutes,
      pet_stage: Math.min(5, 1 + Math.floor(nextMinutes / 60)),
    })
    .eq("id", userId);
}
