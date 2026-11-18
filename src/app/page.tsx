import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";
import { FeatureIcon } from "@/components/FeatureIcon";
import { BrainLogo } from "@/components/BrainLogo";

export default async function HomePage() {
  let connected = false;
  let errorMsg = "";
  let schedule = {
    schedule_text: "Every first Friday of the month",
    location: "Guidance Counselor's Office",
    note: "",
  };
  let canEditSchedule = false;

  try {
    const supabase = await createClient();
    const { data: scheduleRow, error } = await supabase
      .from("mentalks_schedule")
      .select("id, schedule_text, location, note")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      errorMsg = `${error.message} (${error.code})`;
    } else {
      connected = true;
      if (scheduleRow) schedule = scheduleRow;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      canEditSchedule = profile?.role === "counselor";
    }
  } catch (e: unknown) {
    errorMsg = e instanceof Error ? e.message : "Unable to reach Supabase.";
  }

  return (
    <main className="page-center home-page">
      <div className="connection-status home-connection-status" role="status" aria-live="polite" aria-atomic="true">
        <span className="connection-status-label">
          <span className={`connection-dot ${connected ? "connected" : "disconnected"}`} />
          {connected ? "Connected to database" : "Connection unavailable"}
        </span>
        {!connected && (
          <details className="connection-details">
            <summary>Details</summary>
            <p>{errorMsg || "Check your connection and try again."}</p>
            <p>Check your Supabase configuration if this continues.</p>
          </details>
        )}
      </div>

      <section className="home-hero">
        <Image
          src="/bsc-logo.jpg"
          alt="Batanes State College seal"
          fill
          priority
          sizes="(max-width: 780px) 100vw, 780px"
          className="home-hero-background"
        />

        <div className="home-hero-content">
          <div className="home-brand-mark"><BrainLogo size={34} /></div>

          <p className="home-kicker">Batanes State College</p>
          <h1 className="home-title">MenTalks</h1>
          <p className="home-intro">A safe space to talk, share, and heal.</p>

          <div className="home-actions">
            <Link href="/login" className="btn btn-primary btn-lg">Log in</Link>
            <Link href="/signup" className="btn btn-secondary btn-lg">Sign up</Link>
          </div>
          <p className="home-privacy-cue">Your story is yours. Your privacy matters.</p>
        </div>
      </section>

      <section className="about-mentalks">
        <div>
          <p className="page-eyebrow">A BSC and SSC partnership</p>
          <h2>About MenTalks</h2>
          <p>
            MenTalks: A Continuing Mental Health and Well-Being Initiative is a Supreme Student Council
            program in partnership with the College Guidance Counselor. It creates a respectful space for
            the BSC community to share experiences, learn about mental health, build healthy coping skills,
            reduce stigma, and feel heard and encouraged to seek support.
          </p>
        </div>
        <article className="card mentalks-schedule">
          <p className="page-eyebrow">Monthly gathering</p>
          <h3>MenTalks Schedule</h3>
          <p className="schedule-date">{schedule.schedule_text}</p>
          <p className="schedule-location">{schedule.location}</p>
          {schedule.note && <p className="text-muted">{schedule.note}</p>}
          {canEditSchedule && <Link href="/counselor/mentalks" className="btn btn-secondary btn-sm">Edit schedule</Link>}
        </article>
      </section>

      <section className="home-principles" aria-label="What to expect at MenTalks">
        <article className="home-principle">
          <span className="home-principle-icon"><FeatureIcon name="shield" /></span>
          <h2>Privacy comes first</h2>
          <p>Only your pen name is shown to other members; signup does not ask for your real name or nickname.</p>
          <Link href="/privacy">Read the privacy notice</Link>
        </article>
        <article className="home-principle">
          <span className="home-principle-icon"><FeatureIcon name="user" /></span>
          <h2>Share at your pace</h2>
          <p>Students choose a pen name, and anyone may remain anonymous when sharing experiences publicly.</p>
        </article>
        <article className="home-principle">
          <span className="home-principle-icon"><FeatureIcon name="heart" /></span>
          <h2>Guidance when you need it</h2>
          <p>Send a private message or share a conversation to connect with a BSC counselor.</p>
        </article>
      </section>
    </main>
  );
}
