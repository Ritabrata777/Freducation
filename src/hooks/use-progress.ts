import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/lib/toast";

export type ProgressStatus = "reading" | "completed" | "saved";

export type ProgressRow = {
  material_id: string;
  status: ProgressStatus;
  updated_at: string;
};

const KEY = ["progress", "mine"] as const;

export function useMyProgress() {
  const { user } = useAuth();
  return useQuery({
    queryKey: KEY,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_progress")
        .select("material_id, status, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProgressRow[];
    },
  });
}

export function useMaterialProgress(materialId: string | undefined) {
  const { data } = useMyProgress();
  return data?.find((r) => r.material_id === materialId)?.status ?? null;
}

export function useSetProgress() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { materialId: string; status: ProgressStatus | null }) => {
      if (!user) throw new Error("You need to sign in.");
      if (input.status === null) {
        const { error } = await supabase
          .from("material_progress")
          .delete()
          .eq("user_id", user.id)
          .eq("material_id", input.materialId);
        if (error) throw error;
        return null;
      }
      const { error } = await supabase.from("material_progress").upsert(
        {
          user_id: user.id,
          material_id: input.materialId,
          status: input.status,
        },
        { onConflict: "user_id,material_id" },
      );
      if (error) throw error;
      return input.status;
    },
    onSuccess: (status) => {
      qc.invalidateQueries({ queryKey: KEY });
      if (status === "completed") toast.success("Marked as completed");
      else if (status === "reading") toast.success("Added to Reading");
      else if (status === "saved") toast.success("Saved for later");
      else toast.success("Removed from your list");
    },
    onError: (e) => toast.error("Couldn't update", { description: e instanceof Error ? e.message : "" }),
  });
}
