'use client';

import { useRef, useState } from 'react';

type VoiceResponse = {
  transcription?: string;
  reply?: string;
  error?: string;
};

export default function VoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [reply, setReply] = useState('');
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const startRecording = async () => {
    setError(null);
    setReply('');
    setTranscription('');

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const preferredMime = 'audio/webm;codecs=opus';
    const mimeType = MediaRecorder.isTypeSupported(preferredMime) ? preferredMime : 'audio/webm';

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];

        // Stop mic
        stream.getTracks().forEach((t) => t.stop());

        await sendToBackend(audioBlob);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to process audio');
      }
    };

    recorder.start();
    setRecording(true);

    // Auto-stop after 20 seconds (cost control)
    window.setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
        setRecording(false);
      }
    }, 20000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const sendToBackend = async (audioBlob: Blob) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!baseUrl) {
      setError('NEXT_PUBLIC_API_URL is not set');
      return;
    }

    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice.webm');

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/voice`, {
      method: 'POST',
      body: formData,
    });

    const data = (await response.json().catch(() => ({}))) as VoiceResponse;

    if (!response.ok) {
      setError(data.error || `Request failed (${response.status})`);
      return;
    }

    setReply(data.reply || '');
    setTranscription(data.transcription || '');
  };

  return (
    <div className="space-y-3">
      <button
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        onClick={recording ? stopRecording : startRecording}
      >
        {recording ? 'Stop Recording' : 'Speak'}
      </button>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {transcription ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">You said:</span> {transcription}
        </p>
      ) : null}
      {reply ? <p className="text-sm">{reply}</p> : null}
    </div>
  );
}
