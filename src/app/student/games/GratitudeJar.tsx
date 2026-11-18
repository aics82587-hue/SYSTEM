"use client";

import { useState, useEffect } from "react";

interface GratitudeNote {
  id: string;
  text: string;
  date: string;
  color: string;
}

const PASTEL_COLORS = ["#FDA4AF", "#FDE047", "#86EFAC", "#93C5FD", "#C4B5FD", "#FDBA74"];

const DEFAULT_SAMPLE_NOTES: GratitudeNote[] = [
  { id: "sample-1", text: "A warm and quiet morning with a cup of coffee", date: "Today", color: "#FDE047" },
  { id: "sample-2", text: "A friend who sent a kind message when I needed it", date: "Yesterday", color: "#86EFAC" },
  { id: "sample-3", text: "The feeling of finishing a long day and resting", date: "Nov 2", color: "#93C5FD" },
];

const STORAGE_KEY = "mentalks_wellness_gratitude_notes";

export function GratitudeJar() {
  const [notes, setNotes] = useState<GratitudeNote[]>([]);
  const [inputText, setInputText] = useState("");
  const [isShaking, setIsShaking] = useState(false);
  const [spotlightNote, setSpotlightNote] = useState<GratitudeNote | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNotes(parsed);
          return;
        }
      }
      // Initialize with sample notes if empty
      setNotes(DEFAULT_SAMPLE_NOTES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SAMPLE_NOTES));
    } catch {
      setNotes(DEFAULT_SAMPLE_NOTES);
    }
  }, []);

  // Save to localStorage when notes change
  const saveNotes = (newNotes: GratitudeNote[]) => {
    setNotes(newNotes);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newNotes));
    } catch {
      // Ignore storage errors
    }
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    const randomColor = PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];
    const newNote: GratitudeNote = {
      id: Date.now().toString(),
      text: trimmed,
      date: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      color: randomColor,
    };

    const updated = [newNote, ...notes];
    saveNotes(updated);
    setInputText("");
  };

  const handleShakeJar = () => {
    if (notes.length === 0) return;

    setIsShaking(true);
    setSpotlightNote(null);

    setTimeout(() => {
      setIsShaking(false);
      const randomIndex = Math.floor(Math.random() * notes.length);
      setSpotlightNote(notes[randomIndex]);
    }, 700);
  };

  const handleDeleteNote = (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    saveNotes(updated);
    if (spotlightNote?.id === id) {
      setSpotlightNote(null);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "1rem",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "1.3rem", marginBottom: "0.25rem" }}>🫙 Gratitude Jar</h3>
        <p className="text-muted text-sm">
          Acknowledge small moments of gratitude. Write a note to drop in your jar, or shake the jar to reflect on a past memory.
        </p>
      </div>

      {/* Jar & Spotlight Row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "2.5rem",
          flexWrap: "wrap",
          marginBottom: "2rem",
          width: "100%",
          maxWidth: 680,
        }}
      >
        {/* Animated Glass Jar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              position: "relative",
              width: 170,
              height: 230,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              transform: isShaking ? "rotate(6deg) translateY(-8px)" : "rotate(0)",
              transition: isShaking ? "transform 0.1s ease-in-out" : "transform 0.3s ease",
              animation: isShaking ? "jarJiggle 0.15s infinite alternate" : "none",
            }}
          >
            {/* Jar Lid / Cork */}
            <div
              style={{
                width: 76,
                height: 18,
                background: "linear-gradient(180deg, #B45309, #78350F)",
                borderRadius: "4px 4px 2px 2px",
                border: "1px solid rgba(0,0,0,0.4)",
                boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                zIndex: 2,
              }}
            />
            {/* Jar Neck */}
            <div
              style={{
                width: 90,
                height: 14,
                background: "rgba(255, 255, 255, 0.15)",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                borderTop: "none",
                borderRadius: "2px",
                zIndex: 2,
              }}
            />

            {/* Jar Glass Body */}
            <div
              style={{
                width: 160,
                height: 198,
                borderRadius: "16px 16px 36px 36px",
                background:
                  "linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0%, rgba(var(--brand-rgb), 0.08) 50%, rgba(255, 255, 255, 0.06) 100%)",
                border: "2px solid rgba(255, 255, 255, 0.3)",
                boxShadow: "inset 0 0 20px rgba(255, 255, 255, 0.15), 0 8px 32px rgba(0, 0, 0, 0.4)",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexWrap: "wrap",
                alignContent: "flex-end",
                justifyContent: "center",
                padding: "1rem 0.75rem",
                gap: 6,
              }}
            >
              {/* Glass Reflection Highlight */}
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  left: 12,
                  width: 14,
                  height: 140,
                  background: "linear-gradient(to bottom, rgba(255,255,255,0.4), transparent)",
                  borderRadius: 10,
                  filter: "blur(2px)",
                  pointerEvents: "none",
                }}
              />

              {/* Folded paper notes inside jar */}
              {notes.slice(0, 16).map((n, i) => (
                <div
                  key={n.id}
                  style={{
                    width: 24,
                    height: 18,
                    borderRadius: 3,
                    background: n.color,
                    boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
                    transform: `rotate(${(i * 37) % 60 - 30}deg)`,
                    transition: "transform 0.2s ease",
                  }}
                  title={n.text}
                />
              ))}
            </div>
          </div>

          {/* Jar Count Badge */}
          <div style={{ marginTop: "1rem" }}>
            <span className="badge badge-brand" style={{ fontSize: "0.85rem", padding: "0.3rem 0.8rem" }}>
              {notes.length} note{notes.length === 1 ? "" : "s"} in your jar 🫙
            </span>
          </div>

          {/* Shake Button */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleShakeJar}
            disabled={isShaking || notes.length === 0}
            style={{ marginTop: "0.75rem" }}
            title="Shake jar to view a random memory"
          >
            {isShaking ? "Shaking… 🫙" : "🎲 Shake the Jar"}
          </button>
        </div>

        {/* Spotlight Card */}
        <div
          style={{
            flex: 1,
            minWidth: 260,
            maxWidth: 380,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "1.5rem",
            boxShadow: "var(--shadow-md)",
            minHeight: 220,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {spotlightNote ? (
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: "0.75rem" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--brand-light)",
                  }}
                >
                  From Your Jar ({spotlightNote.date})
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDeleteNote(spotlightNote.id)}
                  title="Remove this note"
                  style={{ padding: "0.2rem 0.4rem", color: "var(--danger)" }}
                >
                  🗑️
                </button>
              </div>

              <blockquote
                style={{
                  fontSize: "1.05rem",
                  lineHeight: 1.5,
                  color: "var(--text-primary)",
                  fontStyle: "italic",
                  borderLeft: `4px solid ${spotlightNote.color}`,
                  paddingLeft: "0.75rem",
                  margin: "0 0 1rem 0",
                }}
              >
                &ldquo;{spotlightNote.text}&rdquo;
              </blockquote>

              <p className="text-muted text-sm" style={{ margin: 0 }}>
                ✨ Remember this feeling of gratitude whenever you need strength.
              </p>
            </div>
          ) : (
            <div style={{ textAlign: "center", margin: "auto 0" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🫙</div>
              <h4 style={{ fontSize: "1rem", color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                Shake for a Memory
              </h4>
              <p className="text-muted text-sm" style={{ margin: 0 }}>
                Click &ldquo;Shake the Jar&rdquo; to draw a random gratitude note from your collection.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleAddNote}
        aria-label="Add gratitude note"
        style={{
          width: "100%",
          maxWidth: 600,
          display: "flex",
          gap: "0.5rem",
          background: "var(--bg-card)",
          padding: "0.75rem",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
        }}
      >
        <input
          type="text"
          className="form-input"
          placeholder="What are you grateful for today? (e.g. fresh breeze, a kind friend…)"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          maxLength={150}
          aria-label="Gratitude note input"
          style={{ flex: 1 }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!inputText.trim()}
          title="Drop note into the jar"
        >
          + Add Note
        </button>
      </form>

      {/* Inline styles for keyframe wobble */}
      <style jsx>{`
        @keyframes jarJiggle {
          0% { transform: rotate(-8deg) translateX(-4px); }
          100% { transform: rotate(8deg) translateX(4px); }
        }
      `}</style>
    </div>
  );
}
