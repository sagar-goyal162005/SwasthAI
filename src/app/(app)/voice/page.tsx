import VoiceRecorder from '@/components/voice-recorder';

export default function VoicePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">SwasthAI Voice</h1>
        <p className="text-sm text-muted-foreground">
          Speak in your language. You’ll get a safe, simple reply.
        </p>
      </div>

      <VoiceRecorder />
    </div>
  );
}
