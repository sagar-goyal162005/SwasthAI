import { Suspense } from 'react';
import ChatbotClient from './chatbot-client';

export default function ChatbotPage() {
  return (
    <Suspense fallback={null}>
      <ChatbotClient />
    </Suspense>
  );
}
