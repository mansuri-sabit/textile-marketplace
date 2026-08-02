"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Voice in and voice out through the browser's own Web Speech API.
 *
 * No server, no audio upload, no third-party key — which is why it is the right
 * choice for a prototype whose demo browser is Chrome. Sarvam is configured in
 * the environment if Hinglish accuracy ever needs to beat what Chrome gives us,
 * and would slot in behind this same hook.
 *
 * Both halves are feature-detected and the UI hides the controls when they are
 * missing, rather than offering a mic that silently does nothing (Firefox has
 * no SpeechRecognition at all).
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

type RecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Never changes after load, so the subscribe half is a no-op. */
const noopSubscribe = () => () => {};

export function useSpeechInput({
  onTranscript,
}: {
  onTranscript: (text: string) => void;
}) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => recognitionCtor() !== null,
    () => false,
  );

  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  // Kept in a ref so restarting recognition does not need a fresh callback
  // identity, which would tear down and rebuild the recogniser mid-sentence.
  const handler = useRef(onTranscript);
  useEffect(() => {
    handler.current = onTranscript;
  }, [onTranscript]);

  const stop = useCallback(() => {
    recognition.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;

    const instance = new Ctor();
    // en-IN matters: Indian place names, fabric terms and numbers are
    // transcribed far better than with the en-US default.
    instance.lang = "en-IN";
    instance.continuous = false;
    instance.interimResults = true;

    instance.onresult = (event) => {
      let transcript = "";
      let final = false;
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) final = true;
      }
      handler.current(transcript);
      if (final) setListening(false);
    };
    instance.onerror = () => setListening(false);
    instance.onend = () => setListening(false);

    recognition.current = instance;
    instance.start();
    setListening(true);
  }, []);

  // A recogniser left running after the panel closes keeps the mic indicator lit.
  useEffect(() => () => recognition.current?.abort(), []);

  return { supported, listening, start, stop };
}

/** Matches the server's cap, so we never pay to synthesise a truncated tail. */
const MAX_TTS_CHARS = 800;

/**
 * Spoken replies, premium first.
 *
 * ElevenLabs goes through our own `/api/tts` because the key must never reach
 * the browser — it bills per character, so a client-side key is someone else's
 * free TTS service. The browser's `speechSynthesis` stays wired as the fallback
 * and takes over on *any* failure: unconfigured deployment, exhausted quota,
 * timeout, or an autoplay policy refusing to start the clip. That is the
 * difference between a demo that sounds good and one that goes silent
 * mid-presentation.
 */
export function useSpeechOutput() {
  const browserSupported = useSyncExternalStore(
    noopSubscribe,
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    () => false,
  );

  const [enabled, setEnabled] = useState(false);
  /** Which voice actually spoke last — the UI can surface it honestly. */
  const [voice, setVoice] = useState<"premium" | "browser" | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const cancel = useCallback(() => {
    if (audio.current) {
      audio.current.pause();
      audio.current.src = "";
      audio.current = null;
    }
    if (browserSupported) window.speechSynthesis.cancel();
  }, [browserSupported]);

  const speakLocally = useCallback(
    (text: string) => {
      if (!browserSupported) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-IN";
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
      setVoice("browser");
    },
    [browserSupported],
  );

  const speak = useCallback(
    async (raw: string) => {
      if (!enabled) return;

      // Bullets and dashes read as noise out loud.
      const text = raw
        .replace(/[•·—]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_TTS_CHARS);
      if (!text) return;

      cancel();

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (res.ok) {
          const url = URL.createObjectURL(await res.blob());
          const element = new Audio(url);
          element.onended = () => URL.revokeObjectURL(url);
          audio.current = element;
          // Rejects under autoplay policy; that is a fallback case, not an error.
          await element.play();
          setVoice("premium");
          return;
        }
      } catch {
        // Fall through — any failure at all means use the local voice.
      }

      audio.current = null;
      speakLocally(text);
    },
    [enabled, cancel, speakLocally],
  );

  useEffect(() => cancel, [cancel]);

  return {
    supported: browserSupported,
    enabled,
    setEnabled,
    speak,
    cancel,
    voice,
  };
}
