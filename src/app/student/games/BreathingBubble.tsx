"use client";

import { useState, useEffect, useRef } from "react";

type Phase = "idle" | "inhale" | "hold" | "exhale" | "rest";

const PHASE_CONFIG: Record<Phase, { duration: number; label: string; sublabel: string; scale: number; transitionSec: number }> = {
  idle: { duration: 0, label: "Ready to breathe", sublabel: "Click Start when you are ready", scale: 0.8, transitionSec: 0.3 },
  inhale: { duration: 4, label: "Breathe In", sublabel: "Fill your lungs deeply and slowly", scale: 1.3, transitionSec: 4 },
  hold: { duration: 4, label: "Hold", sublabel: "Pause gently, feeling your center", scale: 1.3, transitionSec: 0 },
  exhale: { duration: 4, label: "Breathe Out", sublabel: "Release tension and let everything go", scale: 0.7, transitionSec: 4 },
  rest: { duration: 2, label: "Rest", sublabel: "Relax before the next breath", scale: 0.7, transitionSec: 0 },
};

export function BreathingBubble() {
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [secondsLeft, setSecondsLeft] = useState(4);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);

  const phaseRef = useRef<Phase>("idle");
  const secondsRef = useRef<number>(4);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    secondsRef.current = secondsLeft;
  }, [secondsLeft]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      if (secondsRef.current > 1) {
        setSecondsLeft(prev => prev - 1);
      } else {
        // Transition to next phase
        const cur = phaseRef.current;
        if (cur === "inhale") {
          setPhase("hold");
          setSecondsLeft(PHASE_CONFIG.hold.duration);
        } else if (cur === "hold") {
          setPhase("exhale");
          setSecondsLeft(PHASE_CONFIG.exhale.duration);
        } else if (cur === "exhale") {
          setPhase("rest");
          setSecondsLeft(PHASE_CONFIG.rest.duration);
        } else if (cur === "rest" || cur === "idle") {
          setPhase("inhale");
          setSecondsLeft(PHASE_CONFIG.inhale.duration);
          setCyclesCompleted(c => c + 1);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive]);

  const handleStart = () => {
    if (!isActive) {
      if (phase === "idle") {
        setPhase("inhale");
        setSecondsLeft(PHASE_CONFIG.inhale.duration);
      }
      setIsActive(true);
    } else {
      setIsActive(false);
    }
  };

  const handleReset = () => {
    setIsActive(false);
    setPhase("idle");
    setSecondsLeft(4);
    setCyclesCompleted(0);
  };

  const currentConfig = PHASE_CONFIG[phase];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 460,
        textAlign: "center",
        padding: "1rem",
      }}
    >
      <div style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "1.3rem", marginBottom: "0.25rem" }}>🫧 Breathing Bubble</h3>
        <p className="text-muted text-sm">
          Follow the expanding bubble. Inhale for 4s, hold for 4s, exhale for 4s, and rest for 2s.
        </p>
      </div>

      {/* Bubble Stage */}
      <div
        style={{
          width: 300,
          height: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          margin: "1rem 0 2rem 0",
        }}
      >
        {/* Soft background glow halo */}
        <div
          style={{
            position: "absolute",
            width: 260,
            height: 260,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(var(--brand-rgb), 0.22) 0%, transparent 70%)",
            filter: "blur(20px)",
            pointerEvents: "none",
          }}
        />

        {/* The Animated Bubble */}
        <div
          style={{
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, var(--brand-light), var(--brand) 45%, #6aa9be 80%, var(--bg-elevated))",
            boxShadow: isActive
              ? "0 0 50px rgba(var(--brand-rgb), 0.45), 0 0 100px rgba(106, 169, 190, 0.25), inset 0 0 30px rgba(255, 255, 255, 0.35)"
              : "0 0 25px rgba(var(--brand-rgb), 0.24), inset 0 0 15px rgba(255, 255, 255, 0.2)",
            transform: `scale(${currentConfig.scale})`,
            transition: `transform ${currentConfig.transitionSec}s ease-in-out`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            color: "#fff",
            userSelect: "none",
          }}
        >
          <span style={{ fontSize: "1.35rem", fontWeight: 700, letterSpacing: "0.02em" }}>
            {currentConfig.label}
          </span>
          {isActive && (
            <span
              style={{
                fontSize: "2.2rem",
                fontWeight: 800,
                marginTop: "0.2rem",
                lineHeight: 1,
                fontFamily: "'Outfit', sans-serif",
                textShadow: "0 2px 8px rgba(0,0,0,0.4)",
              }}
            >
              {secondsLeft}s
            </span>
          )}
        </div>
      </div>

      {/* Sublabel */}
      <p
        style={{
          fontSize: "0.95rem",
          color: "var(--brand-light)",
          fontWeight: 500,
          minHeight: 24,
          marginBottom: "1.5rem",
        }}
      >
        {currentConfig.sublabel}
      </p>

      {/* Controls */}
      <div className="flex items-center gap-2" style={{ marginBottom: "1.5rem" }}>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={handleStart}
          style={{ minWidth: 150 }}
          title={isActive ? "Pause breathing exercise" : "Start breathing exercise"}
        >
          {isActive ? "⏸ Pause" : phase === "idle" ? "▶ Start" : "▶ Resume"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleReset}
          title="Reset timer and cycle count"
        >
          Reset
        </button>
      </div>

      {/* Stats Counter */}
      <div className="flex items-center gap-3 text-muted text-sm">
        <span className="badge badge-brand" style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem" }}>
          Cycles Completed: {cyclesCompleted}
        </span>
        <span>•</span>
        <span>Recommended: 3 to 5 full cycles</span>
      </div>
    </div>
  );
}
