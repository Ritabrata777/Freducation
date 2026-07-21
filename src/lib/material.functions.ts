import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SignedUrlInput = {
  file_url: string;
};

export const getMaterialSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SignedUrlInput) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin
      .storage.from("materials")
      .createSignedUrl(data.file_url, 60 * 30);

    if (error || !signed?.signedUrl) {
      throw new Error(error?.message ?? "Unable to create signed URL for this file.");
    }

    return signed.signedUrl;
  });
