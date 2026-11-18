"use client";

import { useState, useEffect, useRef } from "react";

interface StepConfig {
  sense: string;
  icon: string;
  title: string;
  prompt: string;
  count: number;
  duration: number; // in seconds
  placeholders: string[];
}

const STEPS: StepConfig[] = [
  {
    sense: "Sight",
    icon: "👁️",
    title: "5 Things You Can SEE",
    prompt: "Look around your space. Notice colors, shapes, light reflections, or small details in objects.",
    count: 5,
    duration: 60,
    placeholders: [
      "e.g. The pattern on the wall",
      "e.g. Sunlight reflecting off the floor",
      "e.g. A book on the table",
      "e.g. A blue pen",
      "e.g. My shoes",
    ],
  },
  {
    sense: "Touch",
    icon: "✋",
    title: "4 Things You Can TOUCH",
    prompt: "Notice the textures against your skin: clothing, the chair underneath you, smooth glass, or cool air.",
    count: 4,
    duration: 45,
    placeholders: [
      "e.g. The soft fabric of my shirt",
      "e.g. The cool surface of my desk",
      "e.g. The weight of my feet on the floor",
      "e.g. The smooth edge of my phone",
    ],
  },
  {
    sense: "Sound",
    icon: "👂",
    title: "3 Things You Can HEAR",
    prompt: "Close your eyes or look down. Listen for distant traffic, a ticking clock, birds, or your own breathing.",
    count: 3,
    duration: 30,
    placeholders: [
      "e.g. The gentle hum of an electric fan",
      "e.g. Distant voices or footsteps",
      "e.g. The steady rhythm of my breathing",
    ],
  },
  {
    sense: "Smell",
    icon: "👃",
    title: "2 Things You Can SMELL",
    prompt: "Inhale gently through your nose. Notice any subtle fragrance, coffee, fresh laundry, or rain.",
    count: 2,
    duration: 20,
    placeholders: [
      "e.g. Scent of clean air or soap",
      "e.g. Coffee or tea nearby",
    ],
  },
  {
    sense: "Taste",
    icon: "👅",
    title: "1 Thing You Can TASTE",
    prompt: "Notice lingering flavors in your mouth, a sip of water, mint, or simply the neutral warmth of your breath.",
    count: 1,
    duration: 10,
    placeholders: [
      "e.g. Fresh water or mint toothpaste",
    ],
  },
];

export function GroundingExercise() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [answers, setAnswers] = useState<string[][]>(() =>
    STEPS.map(s => Array(s.count).fill(""))
  );

  const [secondsLeft, setSecondsLeft] = useState(STEPS[0].duration);
  const [timerRunning, setTimerRunning] = useState(true);
  const timerRef = useRef<number>(STEPS[0].duration);

  useEffect(() => {
    timerRef.current = secondsLeft;
  }, [secondsLeft]);

  // Handle timer countdown
  useEffect(() => {
    if (!timerRunning || isCompleted) return;

    const interval = setInterval(() => {
      if (timerRef.current > 0) {
        setSecondsLeft(prev => prev - 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timerRunning, isCompleted]);

  // Reset timer on step change
  const goToStep = (stepIdx: number) => {
    setCurrentStep(stepIdx);
    const dur = STEPS[stepIdx].duration;
    setSecondsLeft(dur);
    setTimerRunning(true);
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      goToStep(currentStep + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  };

  const handleInputChange = (itemIdx: number, val: string) => {
    setAnswers(prev => {
      const next = prev.map(arr => [...arr]);
      next[currentStep][itemIdx] = val;
      return next;
    });
  };

  const handleRestart = () => {
    setCurrentStep(0);
    setIsCompleted(false);
    setAnswers(STEPS.map(s => Array(s.count).fill("")));
    setSecondsLeft(STEPS[0].duration);
    setTimerRunning(true);
  };

  const activeStep = STEPS[currentStep];
  const progressPercent = Math.round(((currentStep + 1) / STEPS.length) * 100);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "1rem",
        width: "100%",
        maxWidth: 680,
        margin: "0 auto",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "1.3rem", marginBottom: "0.25rem" }}>🖐️ 5-4-3-2-1 Sensory Grounding</h3>
        <p className="text-muted text-sm">
          A proven psychological technique to bring your mind back to the present moment through your 5 senses.
        </p>
      </div>

      {!isCompleted ? (
        <div style={{ width: "100%" }}>
          {/* Progress Bar */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div className="flex items-center justify-between text-sm" style={{ marginBottom: "0.4rem" }}>
              <span style={{ fontWeight: 600, color: "var(--brand-light)" }}>
                Step {currentStep + 1} of 5: {activeStep.sense}
              </span>
              <span className="text-muted">{progressPercent}% Completed</span>
            </div>
            <div
              style={{
                width: "100%",
                height: 8,
                background: "var(--bg-elevated)",
                borderRadius: 99,
                overflow: "hidden",
                border: "1px solid var(--border-light)",
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, var(--brand), var(--success))",
                  borderRadius: 99,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>

          {/* Active Step Card */}
          <div
            className="card"
            style={{
              padding: "1.75rem",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-md)",
              marginBottom: "1.5rem",
            }}
          >
            {/* Step Header */}
            <div className="flex items-center justify-between" style={{ marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: "2rem" }}>{activeStep.icon}</span>
                <div>
                  <h4 style={{ fontSize: "1.2rem", margin: 0 }}>{activeStep.title}</h4>
                  <p className="text-muted text-sm" style={{ margin: 0 }}>
                    {activeStep.prompt}
                  </p>
                </div>
              </div>

              {/* Countdown Timer */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  background: secondsLeft <= 5 ? "rgba(248, 113, 113, 0.15)" : "rgba(var(--brand-rgb), 0.12)",
                  border: secondsLeft <= 5 ? "1px solid var(--danger)" : "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.4rem 0.75rem",
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    color: secondsLeft <= 5 ? "var(--danger)" : "var(--brand-light)",
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  ⏱ {secondsLeft}s
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setTimerRunning(r => !r)}
                  style={{ padding: "0.1rem 0.3rem", fontSize: "0.75rem" }}
                  title={timerRunning ? "Pause timer" : "Resume timer"}
                >
                  {timerRunning ? "⏸" : "▶"}
                </button>
              </div>
            </div>

            {/* Inputs List */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleNext();
              }}
              aria-label="Grounding exercise inputs"
              style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1.25rem" }}
            >
              {Array.from({ length: activeStep.count }).map((_, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: "rgba(var(--brand-rgb), 0.15)",
                      color: "var(--brand-light)",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={activeStep.placeholders[idx] ?? `Item ${idx + 1}`}
                    value={answers[currentStep][idx]}
                    onChange={e => handleInputChange(idx, e.target.value)}
                    style={{ fontSize: "0.9rem", padding: "0.55rem 0.85rem" }}
                  />
                </div>
              ))}

              {/* Navigation Actions */}
              <div
                className="flex items-center justify-between"
                style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border-light)" }}
              >
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handlePrev}
                  disabled={currentStep === 0}
                  title="Go back to previous step"
                >
                  ← Previous
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    title={currentStep === STEPS.length - 1 ? "Finish grounding exercise" : "Proceed to next sensory step"}
                  >
                    {currentStep === STEPS.length - 1 ? "Finish Exercise ✨" : "Next Step →"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* Completion Screen */
        <div
          className="card"
          style={{
            padding: "2.5rem 2rem",
            textAlign: "center",
            width: "100%",
            animation: "slideUp 0.3s ease",
            background: "linear-gradient(135deg, rgba(var(--brand-rgb), 0.08), rgba(var(--accent-rgb), 0.08))",
            border: "1px solid rgba(34, 211, 165, 0.3)",
          }}
        >
          <div style={{ fontSize: "3.5rem", marginBottom: "0.75rem" }}>🌟</div>
          <h2 style={{ fontSize: "1.6rem", color: "var(--success)", marginBottom: "0.5rem" }}>
            Grounding Complete
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              lineHeight: 1.6,
              maxWidth: 480,
              margin: "0 auto 1.5rem auto",
            }}
          >
            &ldquo;You are grounded, centered, and safe right here in this moment.&rdquo;
          </p>

          {/* Sensory Summary */}
          <div
            style={{
              background: "var(--bg-elevated)",
              borderRadius: "var(--radius-md)",
              padding: "1.25rem",
              textAlign: "left",
              maxWidth: 480,
              margin: "0 auto 1.75rem auto",
              border: "1px solid var(--border-light)",
            }}
          >
            <h4 style={{ fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>
              What Anchored You Today:
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.9rem" }}>
              {STEPS.map((step, idx) => {
                const filled = answers[idx].filter(Boolean);
                return (
                  <div key={step.sense} className="flex items-center gap-2">
                    <span>{step.icon}</span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{step.sense}:</span>
                    <span className="text-muted">
                      {filled.length > 0 ? filled.slice(0, 3).join(", ") + (filled.length > 3 ? "…" : "") : "Mindfully observed"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRestart}
            title="Start a new grounding exercise"
          >
            Start Again
          </button>
        </div>
      )}
    </div>
  );
}
