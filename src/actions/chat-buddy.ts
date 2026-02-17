/**
 * SwasthAI - AI-Powered Personalized Wellness Companion
 * Copyright © 2025 Akash Rathaur. All Rights Reserved.
 * 
 * Chat Buddy Server Action - AI-powered wellness conversations
 * Handles intelligent chat interactions with personalized AI companions
 * 
 * @author Akash Rathaur
 * @email akashsrathaur@gmail.com
 * @website https://github.com/akashsrathaur
 */

'use server';

import { chatWithBuddy } from "@/ai/flows/chat-buddy";
import { ensureGeminiEnv } from "@/lib/gemini-env";
import { z } from "zod";


const ChatActionInputSchema = z.object({
    message: z.string(),
    buddyPersona: z.string(),
    chatHistory: z.string(),
    userData: z.string()
});


export type Message = {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
}

export type ChatResponse = {
    response?: string;
    error?: string;
}

export async function chatBuddyAction(
  formData: FormData
): Promise<ChatResponse> {
    const parsedData = ChatActionInputSchema.safeParse({
        message: formData.get('message'),
        buddyPersona: formData.get('buddyPersona'),
        chatHistory: formData.get('chatHistory'),
        userData: formData.get('userData')
    });

    if (!parsedData.success) {
        return { error: "Invalid input." };
    }

    try {
        ensureGeminiEnv();

        const { message } = parsedData.data;
        const buddyPersona = JSON.parse(parsedData.data.buddyPersona);
        const userData = JSON.parse(parsedData.data.userData);
        const chatHistoryForAI = JSON.parse(parsedData.data.chatHistory);
        
        const result = await chatWithBuddy(
            {
                message,
                buddyPersona,
                chatHistory: chatHistoryForAI,
                userData,
            }
        );
        
        return { response: result.response };

    } catch (error) {
        console.error("Error in chatBuddyAction:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
        return { error: errorMessage };
    }
}
