import { createClient } from "@/lib/supabase/server";

export async function SupportBanner() {
  let content = "";
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("support_banner")
      .select("content")
      .eq("is_active", true)
      .order("id", { ascending: false })
      .limit(1)
      .single();
    content = data?.content ?? "";
  } catch {
    // silently ignore if table doesn't exist yet
  }

  if (!content) return null;

  return (
    <div className="support-banner" role="banner">
      <span className="support-banner-icon">💬</span>
      <span>{content}</span>
    </div>
  );
}
