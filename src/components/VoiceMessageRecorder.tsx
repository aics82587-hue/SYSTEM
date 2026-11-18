"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  onRecordingComplete?: (blob: Blob, url: string) => void;
  onCancel?: () => void;
  onSend?: (blob: Blob) => void;
  disabled?: boolean;
}

type RecordStatus = "idle" | "recording" | "paused" | "stopped";

const MAX_RECORDING_SECONDS = 120; // 2 minutes

export function VoiceMessageRecorder({
  onRecordingComplete,
  onCancel,
  onSend,
  disabled,
}: Props) {
  const [status, setStatus] = useState<RecordStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Start audio recording
  const startRecording = async () => {
    setErrorMsg(null);
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Voice recording is not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Select supported mimeType
      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mime = recorder.mimeType || "audio/webm";
        const completeBlob = new Blob(audioChunksRef.current, { type: mime });
        const createdUrl = URL.createObjectURL(completeBlob);
        setAudioBlob(completeBlob);
        setAudioUrl(createdUrl);
        setStatus("stopped");
      };

      recorder.start(250); // collect chunks every 250ms
      setStatus("recording");
      setSeconds(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            stopRecording();
            return MAX_RECORDING_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: unknown) {
      console.error("Microphone access error:", err);
      const msg = err instanceof Error ? err.message : "Unable to access microphone.";
      setErrorMsg(msg);
      setStatus("idle");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && status === "recording") {
      mediaRecorderRef.current.pause();
      setStatus("paused");
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && status === "paused") {
      mediaRecorderRef.current.resume();
      setStatus("recording");
      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            stopRecording();
            return MAX_RECORDING_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  const handleConfirmSend = () => {
    if (audioBlob) {
      if (onRecordingComplete && audioUrl) {
        onRecordingComplete(audioBlob, audioUrl);
      }
      if (onSend) {
        onSend(audioBlob);
        setStatus("idle");
        setAudioBlob(null);
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
          setAudioUrl(null);
        }
      }
    }
  };

  const handleCancel = () => {
    if (status !== "idle") {
      stopRecording();
    }
    setStatus("idle");
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    if (onCancel) {
      onCancel();
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
  };

  if (status === "idle" && onSend && !onRecordingComplete) {
    return (
      <button
        type="button"
        onClick={startRecording}
        className="btn btn-secondary btn-sm"
        disabled={disabled}
        title="Record voice message"
        aria-label="Record voice message"
        style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
      >
        <span aria-hidden="true">🎤</span>
        <span>Record Voice</span>
      </button>
    );
  }

  return (
    <div
      className="card-sm"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.2rem" }} title="Microphone" aria-hidden="true">
            🎤
          </span>
          <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.95rem" }}>
            Voice Message Recorder (Max 2:00)
          </span>
        </div>
        <button
          type="button"
          onClick={handleCancel}
          className="btn btn-ghost btn-sm"
          style={{ padding: "0.2rem 0.5rem", color: "var(--text-muted)" }}
          title="Cancel recording"
        >
          ✕
        </button>
      </div>

      {errorMsg && (
        <div className="notice notice-danger" style={{ fontSize: "0.85rem" }}>
          {errorMsg}
        </div>
      )}

      {/* Idle state */}
      {status === "idle" && (
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            type="button"
            onClick={startRecording}
            className="btn btn-primary"
            disabled={disabled}
            title="Start voice recording"
          >
            <span aria-hidden="true">⏺</span>
            <span>Start Recording</span>
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={handleCancel}
              className="btn btn-secondary"
              title="Cancel voice recording"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Recording or Paused state */}
      {(status === "recording" || status === "paused") && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            background: "var(--bg-card)",
            padding: "1rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-light)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {/* Pulsing red dot + Timer */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                className={`pulse-dot ${status === "recording" ? "active" : "paused"}`}
                title={status === "recording" ? "Recording in progress" : "Recording paused"}
              />
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {formatTime(seconds)} / {formatTime(MAX_RECORDING_SECONDS)}
              </span>
              {status === "paused" && (
                <span className="badge badge-warning">PAUSED</span>
              )}
            </div>

            {/* 5-bar animated waveform */}
            <div
              className={`waveform-bars ${status === "recording" ? "animated" : "static"}`}
              aria-hidden="true"
              title="Voice recording waveform"
            >
              <div className="bar bar-1" />
              <div className="bar bar-2" />
              <div className="bar bar-3" />
              <div className="bar bar-4" />
              <div className="bar bar-5" />
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            {status === "recording" ? (
              <button
                type="button"
                onClick={pauseRecording}
                className="btn btn-secondary btn-sm"
                title="Pause recording"
              >
                ⏸ Pause
              </button>
            ) : (
              <button
                type="button"
                onClick={resumeRecording}
                className="btn btn-primary btn-sm"
                title="Resume recording"
              >
                ▶ Resume
              </button>
            )}

            <button
              type="button"
              onClick={stopRecording}
              className="btn btn-danger btn-sm"
              title="Stop recording and review"
            >
              ⏹ Stop & Review
            </button>

            <button
              type="button"
              onClick={handleCancel}
              className="btn btn-ghost btn-sm"
              title="Cancel recording"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Stopped / Preview state */}
      {status === "stopped" && audioUrl && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            background: "var(--bg-card)",
            padding: "1rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-light)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Audio Preview ({formatTime(seconds)})
            </span>
            <button
              type="button"
              onClick={startRecording}
              className="btn btn-ghost btn-sm"
              title="Discard and re-record audio"
            >
              🔄 Re-record
            </button>
          </div>

          <audio controls src={audioUrl} style={{ width: "100%", height: 40 }}>
            Your browser does not support audio preview.
          </audio>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={handleCancel}
              className="btn btn-secondary btn-sm"
              title="Cancel and discard voice message"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSend}
              className="btn btn-primary btn-sm"
              title="Confirm and attach voice message"
            >
              Confirm & Attach Audio ➤
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .pulse-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--danger);
        }

        .pulse-dot.active {
          animation: pulseRed 1.4s infinite;
        }

        .pulse-dot.paused {
          background: var(--warning);
        }

        @keyframes pulseRed {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.7);
          }
          70% {
            transform: scale(1.1);
            box-shadow: 0 0 0 8px rgba(248, 113, 113, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(248, 113, 113, 0);
          }
        }

        .waveform-bars {
          display: flex;
          align-items: center;
          gap: 4px;
          height: 32px;
        }

        .waveform-bars .bar {
          width: 4px;
          background: var(--brand-light);
          border-radius: 2px;
          height: 8px;
        }

        .waveform-bars.animated .bar-1 {
          animation: waveBar 0.8s ease-in-out infinite 0s;
        }
        .waveform-bars.animated .bar-2 {
          animation: waveBar 0.8s ease-in-out infinite 0.15s;
        }
        .waveform-bars.animated .bar-3 {
          animation: waveBar 0.8s ease-in-out infinite 0.3s;
        }
        .waveform-bars.animated .bar-4 {
          animation: waveBar 0.8s ease-in-out infinite 0.45s;
        }
        .waveform-bars.animated .bar-5 {
          animation: waveBar 0.8s ease-in-out infinite 0.6s;
        }

        @keyframes waveBar {
          0%,
          100% {
            height: 6px;
          }
          50% {
            height: 28px;
          }
        }
      `}</style>
    </div>
  );
}
