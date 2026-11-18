"use client";

import { useState } from "react";

type MoodKey = "happy" | "calm" | "sad" | "stressed" | "numb";

interface MoodData {
  key: MoodKey;
  emoji: string;
  name: string;
  description: string;
  affirmation: string;
  template: number[][]; // 8x8: 0 = blank, 1 = default outline
}

const PALETTE = [
  { name: "Lavender", color: "#C4B5FD" },
  { name: "Sky Blue", color: "#93C5FD" },
  { name: "Mint Green", color: "#86EFAC" },
  { name: "Sunshine", color: "#FDE047" },
  { name: "Warm Peach", color: "#FDBA74" },
  { name: "Soft Rose", color: "#FDA4AF" },
  { name: "Pure White", color: "#FFFFFF" },
  { name: "Eraser", color: "#16162A" },
];

const MOODS: MoodData[] = [
  {
    key: "happy",
    emoji: "😊",
    name: "Happy",
    description: "Lighthearted, energetic, or optimistic",
    affirmation: "Celebrate your joy. Let your warmth shine onto others today.",
    template: [
      // Shining Sun / Smiling Heart
      [0, 1, 0, 0, 0, 0, 1, 0],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [0, 0, 1, 0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [0, 1, 0, 0, 0, 0, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
    ],
  },
  {
    key: "calm",
    emoji: "😌",
    name: "Calm",
    description: "Peaceful, quiet, or centered",
    affirmation: "Peace comes from within. Hold onto this tranquility.",
    template: [
      // Lotus / Gentle Wave
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 0, 1, 1, 0, 1, 0],
      [1, 0, 1, 1, 1, 1, 0, 1],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [1, 1, 0, 1, 1, 0, 1, 1],
      [0, 1, 1, 1, 1, 1, 1, 0],
    ],
  },
  {
    key: "sad",
    emoji: "😔",
    name: "Sad",
    description: "Heavy-hearted, lonely, or hurting",
    affirmation: "It is okay to feel sad. You are allowed to take up space and heal in your own time.",
    template: [
      // Gentle Cloud & Rain
      [0, 0, 1, 1, 1, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 1, 0, 0, 1],
      [0, 0, 1, 0, 0, 1, 0, 0],
      [0, 1, 0, 0, 1, 0, 0, 1],
    ],
  },
  {
    key: "stressed",
    emoji: "😤",
    name: "Stressed",
    description: "Overwhelmed, tense, or pressured",
    affirmation: "Take a deep breath. You don't have to carry the whole world all at once.",
    template: [
      // Mountain Peaks / Grounding Labyrinth
      [0, 0, 0, 1, 0, 0, 0, 0],
      [0, 0, 1, 1, 1, 0, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 1, 0, 0, 1, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
    ],
  },
  {
    key: "numb",
    emoji: "😶",
    name: "Numb",
    description: "Detached, drained, or feeling empty",
    affirmation: "Even when things feel quiet and hollow, you are still present and you still matter.",
    template: [
      // Guiding Star
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 0, 1, 1, 0, 1, 0],
      [1, 0, 0, 1, 1, 0, 0, 1],
    ],
  },
];

function initGridFromTemplate(template: number[][], defaultColor = "#4f91a4"): string[][] {
  return template.map(row => row.map(cell => (cell === 1 ? defaultColor : "#16162A")));
}

export function MoodMosaic() {
  const [selectedMood, setSelectedMood] = useState<MoodData | null>(null);
  const [currentColor, setCurrentColor] = useState<string>(PALETTE[0].color);
  const [grid, setGrid] = useState<string[][]>(() =>
    Array(8).fill(null).map(() => Array(8).fill("#16162A"))
  );
  const [isMouseDown, setIsMouseDown] = useState(false);

  const handleSelectMood = (mood: MoodData) => {
    setSelectedMood(mood);
    setGrid(initGridFromTemplate(mood.template, mood.key === "sad" ? "#93C5FD" : mood.key === "happy" ? "#FDE047" : "#C4B5FD"));
  };

  const paintCell = (r: number, c: number) => {
    setGrid(prev => {
      const next = prev.map(row => [...row]);
      next[r][c] = currentColor;
      return next;
    });
  };

  const handleCellClick = (r: number, c: number) => {
    paintCell(r, c);
  };

  const handleCellMouseEnter = (r: number, c: number) => {
    if (isMouseDown) {
      paintCell(r, c);
    }
  };

  const handleResetTemplate = () => {
    if (!selectedMood) return;
    setGrid(initGridFromTemplate(selectedMood.template));
  };

  const handleClearCanvas = () => {
    setGrid(Array(8).fill(null).map(() => Array(8).fill("#16162A")));
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "1rem",
        userSelect: "none",
      }}
      onMouseUp={() => setIsMouseDown(false)}
    >
      <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "1.3rem", marginBottom: "0.25rem" }}>🎨 Mood Mosaic</h3>
        <p className="text-muted text-sm">
          Express your emotional state through gentle color art and read a calming affirmation.
        </p>
      </div>

      {/* Step 1: Mood Selection */}
      <div style={{ marginBottom: "2rem", width: "100%", maxWidth: 640 }}>
        <p style={{ fontWeight: 600, fontSize: "0.95rem", textAlign: "center", marginBottom: "0.75rem" }}>
          How are you feeling right now?
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: "0.6rem",
          }}
        >
          {MOODS.map(m => {
            const isSelected = selectedMood?.key === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => handleSelectMood(m)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "0.75rem 0.5rem",
                  borderRadius: "var(--radius-md)",
                  border: isSelected ? "2px solid var(--brand)" : "1px solid var(--border-light)",
                  background: isSelected ? "rgba(var(--brand-rgb), 0.15)" : "var(--bg-elevated)",
                  cursor: "pointer",
                  transition: "all var(--transition)",
                }}
              >
                <span style={{ fontSize: "1.6rem" }}>{m.emoji}</span>
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    color: isSelected ? "var(--brand-light)" : "var(--text-primary)",
                    marginTop: "0.25rem",
                  }}
                >
                  {m.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Coloring Grid & Palette */}
      {selectedMood && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            maxWidth: 600,
            animation: "slideUp 0.3s ease",
          }}
        >
          {/* Palette Row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              marginBottom: "1.25rem",
              flexWrap: "wrap",
              justifyContent: "center",
              background: "var(--bg-elevated)",
              padding: "0.6rem 1rem",
              borderRadius: "99px",
              border: "1px solid var(--border-light)",
            }}
          >
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
              PALETTE:
            </span>
            {PALETTE.map(p => {
              const isCurrent = currentColor === p.color;
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setCurrentColor(p.color)}
                  title={`${p.name} (${p.color})`}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: p.color,
                    border: isCurrent ? "2px solid #fff" : "1px solid rgba(255,255,255,0.2)",
                    boxShadow: isCurrent ? "0 0 10px rgba(255,255,255,0.6)" : "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    transition: "transform 0.15s ease",
                    transform: isCurrent ? "scale(1.15)" : "scale(1)",
                  }}
                >
                  {p.name === "Eraser" && "🧹"}
                </button>
              );
            })}
          </div>

          {/* 8x8 Canvas */}
          <div
            style={{
              background: "var(--bg-elevated)",
              padding: "10px",
              borderRadius: "var(--radius-lg)",
              border: "2px solid var(--border)",
              boxShadow: "var(--shadow-glow)",
              marginBottom: "1.25rem",
            }}
            onMouseDown={() => setIsMouseDown(true)}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, 36px)",
                gridTemplateRows: "repeat(8, 36px)",
                gap: 3,
              }}
            >
              {grid.map((row, r) =>
                row.map((cellColor, c) => (
                  <div
                    key={`${r}-${c}`}
                    onClick={() => handleCellClick(r, c)}
                    onMouseEnter={() => handleCellMouseEnter(r, c)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 4,
                      background: cellColor,
                      border: "1px solid rgba(255,255,255,0.06)",
                      cursor: "pointer",
                      transition: "background 0.1s ease",
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {/* Canvas Actions */}
          <div className="flex items-center gap-2" style={{ marginBottom: "1.75rem" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleResetTemplate}
              title="Reset to mood shape"
            >
              Reset Template
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClearCanvas}
              title="Clear all pixels"
            >
              Clear Blank
            </button>
          </div>

          {/* Step 3: Affirmation Card */}
          <div
            className="notice notice-brand"
            style={{
              width: "100%",
              maxWidth: 540,
              textAlign: "center",
              padding: "1.25rem 1.5rem",
              borderRadius: "var(--radius-lg)",
              background: "linear-gradient(135deg, rgba(var(--brand-rgb), 0.15), rgba(var(--accent-rgb), 0.1))",
              border: "1px solid rgba(var(--brand-rgb), 0.3)",
            }}
          >
            <span style={{ fontSize: "1.6rem", display: "block", marginBottom: "0.4rem" }}>
              {selectedMood.emoji}
            </span>
            <p
              style={{
                fontSize: "1.05rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                lineHeight: 1.5,
                margin: "0 0 0.5rem 0",
              }}
            >
              &ldquo;{selectedMood.affirmation}&rdquo;
            </p>
            <span className="text-muted text-sm">
              Take this message to heart as you await your counseling session.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
