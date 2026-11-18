"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { FeatureIcon, type FeatureIconName } from "@/components/FeatureIcon";
import { BackToDashboard } from "@/components/BackToDashboard";
import type { AppRole } from "@/lib/identity";

import { BreathingBubble } from "./BreathingBubble";
import { WordSearch } from "./WordSearch";
import { GratitudeJar } from "./GratitudeJar";
import { MoodMosaic } from "./MoodMosaic";
import { GroundingExercise } from "./GroundingExercise";
import { WordPuzzle } from "./WordPuzzle";
import { BlockBlast } from "./BlockBlast";

type GameTab = "bubble" | "wordsearch" | "wordpuzzle" | "blockblast" | "jar" | "mosaic" | "grounding";

interface TabItem {
  id: GameTab;
  title: string;
  icon: FeatureIconName;
  desc: string;
}

const TABS: TabItem[] = [
  { id: "bubble", title: "Breathing Bubble", icon: "heart", desc: "A gentle guided breathing cycle" },
  { id: "wordsearch", title: "Find the Word", icon: "sparkles", desc: "Find wellness words in a changing grid" },
  { id: "wordpuzzle", title: "Word Puzzle", icon: "sparkles", desc: "Unscramble a wellness word" },
  { id: "blockblast", title: "Block Blast", icon: "game", desc: "Complete rows and columns with blocks" },
  { id: "jar", title: "Gratitude Jar", icon: "heart", desc: "Save and revisit grateful moments" },
  { id: "mosaic", title: "Mood Mosaic", icon: "board", desc: "Create a colorful affirmation mosaic" },
  { id: "grounding", title: "5-4-3-2-1 Grounding", icon: "life-buoy", desc: "A guided sensory grounding exercise" },
];

export default function WellnessGamesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ public_name?: string; avatar_id?: string; role?: AppRole }>({});
  const [activeTab, setActiveTab] = useState<GameTab>("bubble");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("public_name, avatar_id, role")
        .eq("id", user.id)
        .single();

      if (prof?.role !== "student" && prof?.role !== "community_member") {
        router.push("/login");
        return;
      }

      setProfile({ ...prof, role: prof.role as AppRole });
      setLoading(false);
    }

    init();
  }, [router]);

  if (loading) {
    return (
      <div className="page-center">
        <div className="flex items-center gap-2 text-muted">
          <div className="spinner" /> Loading Wellness Corner…
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar role={profile.role ?? "student"} nickname={profile.public_name} avatarId={profile.avatar_id} />
      <div className="dashboard-layout">
        <Sidebar role={profile.role ?? "student"} nickname={profile.public_name} avatarId={profile.avatar_id} />
        <main className="dashboard-main">
          <BackToDashboard role={profile.role ?? "student"} />
          {/* Page Header */}
          <PageHeader eyebrow="Take a restorative moment" title="Wellness Games"
            description="Choose a gentle activity to pause, refocus, or recharge." />

          <div className="game-hub" aria-label="Choose a wellness activity">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`game-hub-card${isActive ? " active" : ""}`}
                  aria-pressed={isActive}
                >
                  <span className="game-hub-icon"><FeatureIcon name={tab.icon} size={22} /></span>
                  <span className="game-hub-copy">
                    <strong>{tab.title}</strong>
                    <span>{tab.desc}</span>
                  </span>
                  <span className="game-hub-state">{isActive ? "Selected" : "Open"}</span>
                </button>
              );
            })}
          </div>

          {/* Active Game Container */}
          <div className="card game-container" style={{ minHeight: 520, padding: "2rem 1.5rem" }}>
            {activeTab === "bubble" && <BreathingBubble />}
            {activeTab === "wordsearch" && <WordSearch />}
            {activeTab === "wordpuzzle" && <WordPuzzle />}
            {activeTab === "blockblast" && <BlockBlast />}
            {activeTab === "jar" && <GratitudeJar />}
            {activeTab === "mosaic" && <MoodMosaic />}
            {activeTab === "grounding" && <GroundingExercise />}
          </div>
        </main>
      </div>
    </>
  );
}
