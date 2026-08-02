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

export function useSpeechOutput() {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    () => false,
  );

  const [enabled, setEnabled] = useState(false);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !supported) return;
      // Bullets and arrows read as noise out loud.
      const spoken = text.replace(/[•·—]/g, " ").replace(/\s+/g, " ").trim();
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(spoken);
      utterance.lang = "en-IN";
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    },
    [enabled, supported],
  );

  const cancel = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  useEffect(() => cancel, [cancel]);

  return { supported, enabled, setEnabled, speak, cancel };
}
