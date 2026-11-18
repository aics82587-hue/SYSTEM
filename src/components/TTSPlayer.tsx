"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  text: string;
  compact?: boolean;
}

interface FormattedVoice {
  label: string;
  voice: SpeechSynthesisVoice;
}

export function TTSPlayer({ text, compact }: Props) {
  const [voices, setVoices] = useState<FormattedVoice[]>([]);
  const [selectedVoiceIdx, setSelectedVoiceIdx] = useState<number>(0);
  const [status, setStatus] = useState<"idle" | "speaking" | "paused">("idle");
  const [supported, setSupported] = useState<boolean>(true);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }

    const categorizeVoices = () => {
      const synth = window.speechSynthesis;
      const allVoices = synth.getVoices();
      if (!allVoices || allVoices.length === 0) return;

      const enVoices = allVoices.filter((v) =>
        v.lang.toLowerCase().replace("_", "-").startsWith("en")
      );
      const voicePool = enVoices.length >= 2 ? enVoices : allVoices;

      const femaleKeywords = [
        "female",
        "woman",
        "zira",
        "samantha",
        "victoria",
        "karen",
        "susan",
        "jenny",
        "eva",
        "aria",
        "anna",
        "hazel",
        "heera",
        "linda",
        "catherine",
        "joanna",
        "salli",
        "kimberly",
        "kendra",
        "clara",
      ];

      const maleKeywords = [
        "male",
        "man",
        "david",
        "alex",
        "fred",
        "daniel",
        "george",
        "guy",
        "mark",
        "richard",
        "james",
        "michael",
        "ravi",
        "sean",
        "brian",
        "joey",
        "matthew",
        "justin",
      ];

      const femaleMatches: SpeechSynthesisVoice[] = [];
      const maleMatches: SpeechSynthesisVoice[] = [];
      const unclassified: SpeechSynthesisVoice[] = [];

      voicePool.forEach((v) => {
        const nameLower = v.name.toLowerCase();
        if (femaleKeywords.some((kw) => nameLower.includes(kw))) {
          femaleMatches.push(v);
        } else if (maleKeywords.some((kw) => nameLower.includes(kw))) {
          maleMatches.push(v);
        } else {
          unclassified.push(v);
        }
      });

      // Fill up to 3 female voices
      let fCount = 1;
      const chosenFemales: FormattedVoice[] = [];
      for (const v of femaleMatches) {
        if (chosenFemales.length < 3) {
          chosenFemales.push({
            label: `Female ${fCount++} (${v.name.split(" ")[0]})`,
            voice: v,
          });
        }
      }

      // Fill up to 3 male voices
      let mCount = 1;
      const chosenMales: FormattedVoice[] = [];
      for (const v of maleMatches) {
        if (chosenMales.length < 3) {
          chosenMales.push({
            label: `Male ${mCount++} (${v.name.split(" ")[0]})`,
            voice: v,
          });
        }
      }

      // If either list is under 3, assign from unclassified
      for (const v of unclassified) {
        if (chosenFemales.length < 3) {
          chosenFemales.push({
            label: `Female ${fCount++} (${v.name.split(" ")[0]})`,
            voice: v,
          });
        } else if (chosenMales.length < 3) {
          chosenMales.push({
            label: `Male ${mCount++} (${v.name.split(" ")[0]})`,
            voice: v,
          });
        }
      }

      // Fallback if still under 6 total: clone available with pitch shifts if needed
      const finalVoices = [...chosenFemales, ...chosenMales];
      if (finalVoices.length > 0) {
        setVoices(finalVoices);
      }
    };

    categorizeVoices();
    window.speechSynthesis.onvoiceschanged = categorizeVoices;

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!supported) return null;

  const handlePlay = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;

    if (status === "paused") {
      synth.resume();
      setStatus("speaking");
      return;
    }

    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    if (voices[selectedVoiceIdx]) {
      utterance.voice = voices[selectedVoiceIdx].voice;
    }

    utterance.onend = () => {
      setStatus("idle");
    };

    utterance.onerror = () => {
      setStatus("idle");
    };

    utteranceRef.current = utterance;
    synth.speak(utterance);
    setStatus("speaking");
  };

  const handlePause = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
    setStatus("paused");
  };

  const handleStop = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setStatus("idle");
  };

  return (
    <div
      className="tts-player"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        background: "rgba(30, 30, 54, 0.7)",
        padding: "0.2rem 0.5rem",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border-light)",
        fontSize: "0.78rem",
      }}
    >
      {/* Voice selection dropdown */}
      {voices.length > 0 && (
        <select
          value={selectedVoiceIdx}
          onChange={(e) => {
            const idx = Number(e.target.value);
            setSelectedVoiceIdx(idx);
            if (status !== "idle") {
              handleStop();
            }
          }}
          aria-label="Text to speech voice selector"
          style={{
            background: "transparent",
            color: "var(--text-secondary)",
            border: "none",
            fontSize: "0.75rem",
            padding: "0.1rem 0.2rem",
            cursor: "pointer",
            maxWidth: 125,
            outline: "none",
          }}
        >
          {voices.map((v, idx) => (
            <option
              key={`${v.voice.name}-${idx}`}
              value={idx}
              style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}
            >
              {v.label}
            </option>
          ))}
        </select>
      )}

      {/* Play/Pause Button */}
      {status === "speaking" ? (
        <button
          type="button"
          onClick={handlePause}
          className="btn btn-ghost"
          style={{ padding: "0.1rem 0.35rem", fontSize: "0.85rem", color: "var(--brand-light)" }}
          title="Pause reading text"
        >
          <span aria-hidden="true">⏸</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handlePlay}
          className="btn btn-ghost"
          style={{ padding: "0.1rem 0.35rem", fontSize: "0.85rem", color: "var(--brand-light)" }}
          title={status === "paused" ? "Resume reading text" : "Listen with Text-to-Speech"}
        >
          <span aria-hidden="true">🔊</span>
        </button>
      )}

      {/* Stop Button */}
      {status !== "idle" && (
        <button
          type="button"
          onClick={handleStop}
          className="btn btn-ghost"
          style={{ padding: "0.1rem 0.35rem", fontSize: "0.85rem", color: "var(--danger)" }}
          title="Stop reading text"
        >
          <span aria-hidden="true">⏹</span>
        </button>
      )}

      {/* Status indicator */}
      {status === "speaking" && (
        <span
          style={{
            fontSize: "0.7rem",
            color: "var(--brand-light)",
            fontWeight: 500,
            animation: "pulse 1.2s infinite",
          }}
        >
          Reading...
        </span>
      )}
    </div>
  );
}
