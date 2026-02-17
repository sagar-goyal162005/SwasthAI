
/**
 * SwasthAI - AI-Powered Personalized Wellness Companion
 * Copyright © 2025 Akash Rathaur. All Rights Reserved.
 * 
 * Chat Buddy Component - Personalized AI wellness companion
 * Features adaptive personality and intelligent health conversations
 * 
 * @author Akash Rathaur
 * @email akashsrathaur@gmail.com
 * @website https://github.com/akashsrathaur
 */

'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Send, X, User, Check, CheckCheck, Maximize2, Lock, Mic, Square, Bell, Flame, Sparkles, Moon, Footprints, Leaf, History, Trash2 } from 'lucide-react';
import { chatBuddyAction, type Message } from '@/actions/chat-buddy';
import { symptomCheckChatAction } from '@/actions/symptom-check';
import { nanoid } from 'nanoid';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import React from 'react';
import { useAuth } from '@/context/auth-context';
import { defaultUser, type BuddyPersona, type User as AppUser } from '@/lib/user-store';
import { getApiBaseUrl } from '@/lib/api-client';
import Image from 'next/image';

const MessageStatus = ({ status }: { status: Message['status'] }) => {
    if (status === 'read') {
        return <CheckCheck className="h-4 w-4 text-secondary" />;
    }
    if (status === 'delivered') {
        return <CheckCheck className="h-4 w-4 text-muted-foreground" />;
    }
    if (status === 'sent') {
        return <Check className="h-4 w-4 text-muted-foreground" />;
    }
    return null;
}

type ChatBuddyProps = {
    defaultOpen?: boolean;
    defaultMaximized?: boolean;
    hideLauncher?: boolean;
    variant?: 'floating' | 'embedded';
    sidebarTab?: 'history' | 'new' | null;
};

type StoredChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
};

type StoredChat = {
    id: string;
    title: string;
    createdAt: string;
    messages: StoredChatMessage[];
};

function storageKeyForUser(userId: string | undefined): string {
    const safe = (userId || 'local').trim() || 'local';
    return `swasthai_chats_v1_${safe}`;
}

function activeKeyForUser(userId: string | undefined): string {
    const safe = (userId || 'local').trim() || 'local';
    return `swasthai_active_chat_v1_${safe}`;
}

function safeReadJson<T>(key: string, fallback: T): T {
    try {
        if (typeof window === 'undefined') return fallback;
        const raw = window.localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

function safeWriteJson(key: string, value: unknown): void {
    try {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // ignore
    }
}

const symptomLikeRegex = /(symptom|fever|headache|cough|cold|pain|vomit|vomiting|diarrhea|nausea|rash|itch|sore throat|throat pain|stomach|abdominal|dizzy|dizziness|breath|breathing|blood|bleeding|infection|allergy)/i;

 export function ChatBuddy({ defaultOpen = false, defaultMaximized = false, hideLauncher = false, variant = 'floating', sidebarTab = null }: ChatBuddyProps) {
     const isEmbedded = variant === 'embedded';

     const [isOpen, setIsOpen] = useState(isEmbedded ? true : defaultOpen);
     const [isMaximized, setIsMaximized] = useState(isEmbedded ? false : defaultMaximized);
    const { user } = useAuth();
    const userData: AppUser = user ?? { ...defaultUser, uid: 'local' };
    const rawPersona = userData.buddyPersona || defaultUser.buddyPersona!;
    const persona = rawPersona.name === 'Zen' ? { ...rawPersona, name: 'Arohi' } : rawPersona;

    useEffect(() => {
        if (isEmbedded) {
            setIsOpen(true);
            setIsMaximized(false);
            return;
        }
        setIsOpen(defaultOpen);
        setIsMaximized(defaultMaximized);
    }, [defaultOpen, defaultMaximized]);
    
    const formRef = useRef<HTMLFormElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const [recording, setRecording] = useState(false);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const speechRecognitionRef = useRef<any>(null);
    const usingSpeechRecognitionRef = useRef(false);
    const speechRecognitionFailuresRef = useRef(0);
    const disableSpeechRecognitionRef = useRef(false);

    const wavRecordingRef = useRef<{
        audioContext: AudioContext;
        processor: ScriptProcessorNode;
        source: MediaStreamAudioSourceNode;
        buffers: Float32Array[];
        sampleRate: number;
    } | null>(null);

    const systemMessage = useMemo<Message>(() => ({
        id: `sys_${nanoid()}`,
        role: 'system' as const,
        content: "Might occasionally roast you, but only out of love",
        timestamp: new Date().toISOString(),
    }), []);

    const userStorageKey = storageKeyForUser(userData.uid);
    const activeStorageKey = activeKeyForUser(userData.uid);

    const [chats, setChats] = useState<StoredChat[]>(() => safeReadJson<StoredChat[]>(userStorageKey, []));
    const [activeChatId, setActiveChatId] = useState<string | null>(() => safeReadJson<string | null>(activeStorageKey, null));
    const [showHistory, setShowHistory] = useState(false);

    const [messages, setMessages] = useState<Message[]>([systemMessage]);
    const [error, setError] = useState<string | null>(null);
    
    const scrollAreaViewportRef = useRef<HTMLDivElement>(null);

    const hasConversation = messages.some((m) => m.role === 'user' || m.role === 'model');

    const activeChat = useMemo(() => chats.find((c) => c.id === activeChatId) || null, [chats, activeChatId]);

    const ensureActiveChatId = () => {
        if (activeChatId) return activeChatId;
        const id = `chat_${nanoid()}`;
        const newChat: StoredChat = {
            id,
            title: 'New Chat',
            createdAt: new Date().toISOString(),
            messages: [],
        };
        setChats((prev) => [newChat, ...prev]);
        setActiveChatId(id);
        setMessages([systemMessage]);
        return id;
    };

    const syncMessagesFromChat = (chat: StoredChat | null) => {
        if (!chat) {
            setMessages([systemMessage]);
            return;
        }

        const converted: Message[] = chat.messages.map((m) => ({
            id: m.id,
            role: m.role === 'assistant' ? 'model' : 'user',
            content: m.content,
            timestamp: m.timestamp,
            status: m.role === 'user' ? 'read' : undefined,
        }));
        setMessages([systemMessage, ...converted]);
    };

    const createNewChat = () => {
        const id = `chat_${nanoid()}`;
        const newChat: StoredChat = {
            id,
            title: 'New Chat',
            createdAt: new Date().toISOString(),
            messages: [],
        };
        setChats((prev) => [newChat, ...prev]);
        setActiveChatId(id);
        setError(null);
        setMessages([systemMessage]);
        window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50);
    };

    const deleteChat = (chatId: string) => {
        setChats((prev) => {
            const nextChats = prev.filter((c) => c.id !== chatId);

            if (activeChatId === chatId) {
                const nextActive = nextChats[0]?.id ?? null;
                setActiveChatId(nextActive);
                setError(null);
                if (!nextActive) {
                    setMessages([systemMessage]);
                }
            }

            return nextChats;
        });
    };

    const clearChatHistory = () => {
        setChats([]);
        setActiveChatId(null);
        setError(null);
        setMessages([systemMessage]);
    };

    const appendToActiveChat = (role: 'user' | 'assistant', content: string, opts?: { status?: Message['status'] }) => {
        const chatId = ensureActiveChatId();
        const timestamp = new Date().toISOString();
        const id = nanoid();
        const stored: StoredChatMessage = { id, role, content, timestamp };

        setChats((prev) =>
            prev.map((c) => {
                if (c.id !== chatId) return c;
                const shouldSetTitle = c.title === 'New Chat' && c.messages.length === 0 && role === 'user';
                return {
                    ...c,
                    title: shouldSetTitle ? content.slice(0, 20) : c.title,
                    messages: [...c.messages, stored],
                };
            })
        );

        const uiMsg: Message = {
            id,
            role: role === 'assistant' ? 'model' : 'user',
            content,
            timestamp,
            status: role === 'user' ? (opts?.status ?? 'sent') : undefined,
        };

        setMessages((current) => [...current, uiMsg]);
        return uiMsg;
    };

    const quickPrompts = [
        { icon: '🍽️', text: 'Suggest healthy meal ideas' },
        { icon: '🦾', text: 'Plan a new workout routine' },
        { icon: '❄️', text: 'How can I recover quickly from a cold?' },
    ];

    const scrollToBottom = () => {
        if (scrollAreaViewportRef.current) {
            scrollAreaViewportRef.current.scrollTo({
                top: scrollAreaViewportRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    };
    
    useEffect(() => {
        scrollToBottom();
    }, [messages, isPending]);

    // Persist chat history and active chat.
    useEffect(() => {
        safeWriteJson(userStorageKey, chats);
    }, [chats, userStorageKey]);

    useEffect(() => {
        safeWriteJson(activeStorageKey, activeChatId);
    }, [activeChatId, activeStorageKey]);

    // Ensure an active chat exists, and sync UI messages when switching.
    useEffect(() => {
        if (!activeChatId && chats.length > 0) {
            setActiveChatId(chats[0].id);
            return;
        }
        if (!activeChatId && chats.length === 0) {
            // First run: create a starter chat.
            createNewChat();
            return;
        }
        if (activeChatId && !activeChat && chats.length > 0) {
            setActiveChatId(chats[0].id);
            return;
        }
        syncMessagesFromChat(activeChat);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeChatId, chats]);

    // Sidebar tab integration (used by the app sidebar links on /chatbot).
    useEffect(() => {
        if (sidebarTab === 'history') {
            setShowHistory(true);
            return;
        }
        if (sidebarTab === 'new') {
            setShowHistory(false);
            createNewChat();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sidebarTab]);
    
    // Restore focus when isPending changes from true to false
    useEffect(() => {
        if (!isPending && inputRef.current && isOpen) {
            const timer = setTimeout(() => {
                inputRef.current?.focus({ preventScroll: true });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isPending, isOpen]);

    const stopRecording = () => {
        if (usingSpeechRecognitionRef.current && speechRecognitionRef.current) {
            try {
                speechRecognitionRef.current.stop();
            } catch {
                // ignore
            }
            usingSpeechRecognitionRef.current = false;
            speechRecognitionRef.current = null;
            setRecording(false);
            return;
        }

        const wav = wavRecordingRef.current;
        if (wav) {
            wavRecordingRef.current = null;
            try {
                wav.processor.disconnect();
                wav.source.disconnect();
            } catch {
                // ignore
            }
            audioStreamRef.current?.getTracks().forEach((t) => t.stop());
            audioStreamRef.current = null;
            wav.audioContext.close().catch(() => undefined);
            void (async () => {
                try {
                    const wavBlob = floatToWavBlob(wav.buffers, wav.sampleRate);
                    const { transcription, reply } = await sendAudioToBackend(wavBlob, 'audio/wav');
                    if (!transcription) {
                        toast({
                            title: 'Could not hear you',
                            description: 'No speech was detected. Please try again and speak closer to the mic.',
                        });
                        return;
                    }

                    appendToActiveChat('user', transcription, { status: 'read' });
                    if (reply) appendToActiveChat('assistant', reply);
                } catch (e) {
                    const message = e instanceof Error ? e.message : 'Failed to process audio';
                    if (
                        message.includes('VOSK_MODEL_PATH') ||
                        message.includes('Voice transcription is not configured') ||
                        message.includes('Offline voice transcription is not configured')
                    ) {
                        toast({
                            title: 'Offline voice transcription not configured',
                            description:
                                'Download a Vosk model, extract it, set VOSK_MODEL_PATH_EN and VOSK_MODEL_PATH_HI (or VOSK_MODEL_PATH) in backend/.env, then restart the backend.',
                            variant: 'destructive',
                        });
                    } else if (message.includes('Offline transcription dependency missing')) {
                        toast({
                            title: 'Offline voice dependency missing',
                            description: 'Backend is missing the Vosk dependency. Install backend requirements and restart the backend.',
                            variant: 'destructive',
                        });
                    } else if (message.includes('Offline transcription expects WAV audio')) {
                        toast({
                            title: 'Voice format mismatch',
                            description: 'Voice upload must be WAV/PCM. Please refresh the app and try again.',
                            variant: 'destructive',
                        });
                    }
                    setError(message);
                }
            })();
        }

        setRecording(false);
    };

    type VoiceApiResponse = {
        transcription?: string;
        reply?: string;
        error?: string;
    };

    const sendAudioToBackend = async (audioBlob: Blob, mimeType: string): Promise<VoiceApiResponse> => {
        const baseUrl = getApiBaseUrl();

        const formData = new FormData();
        const filename = mimeType.includes('wav') ? 'voice.wav' : 'voice.webm';
        formData.append('audio', audioBlob, filename);
        formData.append('languageCode', (navigator.language || 'en-US').toString());

        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/voice`, {
            method: 'POST',
            body: formData,
        });

        const data = (await response.json().catch(() => ({}))) as VoiceApiResponse;
        if (!response.ok) {
            throw new Error(data.error || `Request failed (${response.status})`);
        }

        return {
            transcription: (data.transcription || '').trim(),
            reply: (data.reply || '').trim(),
        };
    };

    const startWavRecording = async () => {
        setError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            audioStreamRef.current = stream;

            // Vosk models work best with 16kHz mono PCM. Creating an AudioContext at 16kHz
            // avoids resampling issues that can lead to empty transcripts.
            let audioContext: AudioContext;
            try {
                audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            } catch {
                audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            await audioContext.resume().catch(() => undefined);
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            const buffers: Float32Array[] = [];

            // Prevent feedback by routing through a zero-gain node.
            const zeroGain = audioContext.createGain();
            zeroGain.gain.value = 0;

            processor.onaudioprocess = (e) => {
                const input = e.inputBuffer.getChannelData(0);
                buffers.push(new Float32Array(input));
            };

            source.connect(processor);
            processor.connect(zeroGain);
            zeroGain.connect(audioContext.destination);

            wavRecordingRef.current = {
                audioContext,
                processor,
                source,
                buffers,
                sampleRate: audioContext.sampleRate,
            };

            setRecording(true);

            // Auto-stop after 8 seconds (keeps UX snappy and avoids “mic running forever”).
            window.setTimeout(() => {
                if (wavRecordingRef.current) {
                    stopRecording();
                }
            }, 8000);
        } catch {
            toast({
                title: 'Microphone blocked',
                description: 'Please allow microphone access to use voice input.',
                variant: 'destructive',
            });
        }
    };

    const floatToWavBlob = (buffers: Float32Array[], sampleRate: number): Blob => {
        const length = buffers.reduce((acc, b) => acc + b.length, 0);
        const pcm16 = new Int16Array(length);
        let offset = 0;
        for (const buffer of buffers) {
            for (let i = 0; i < buffer.length; i++) {
                const s = Math.max(-1, Math.min(1, buffer[i]));
                pcm16[offset++] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }
        }

        const headerSize = 44;
        const byteRate = sampleRate * 2;
        const blockAlign = 2;
        const dataSize = pcm16.length * 2;
        const buffer = new ArrayBuffer(headerSize + dataSize);
        const view = new DataView(buffer);

        const writeString = (pos: number, str: string) => {
            for (let i = 0; i < str.length; i++) view.setUint8(pos + i, str.charCodeAt(i));
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true); // PCM
        view.setUint16(20, 1, true); // format
        view.setUint16(22, 1, true); // mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, 16, true); // bits
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        let idx = 44;
        for (let i = 0; i < pcm16.length; i++, idx += 2) {
            view.setInt16(idx, pcm16[i], true);
        }

        return new Blob([buffer], { type: 'audio/wav' });
    };

    const tryStartSpeechRecognition = async (): Promise<boolean> => {
        const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionCtor) return false;
        if (disableSpeechRecognitionRef.current) return false;

        setError(null);

        const startedAt = Date.now();
        let retries = 0;
        let gotFinal = false;
        let maxListenTimer: number | null = null;

        const recognition = new SpeechRecognitionCtor();
        recognition.lang = (navigator.language || 'en-US');
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.continuous = true;

        usingSpeechRecognitionRef.current = true;
        speechRecognitionRef.current = recognition;

        recognition.onresult = async (event: any) => {
            try {
                const results = event?.results;
                const lastResult = results?.[results.length - 1];
                const transcript = (lastResult?.[0]?.transcript || '').toString().trim();
                const isFinal = Boolean(lastResult?.isFinal);

                if (!transcript) return;

                if (isFinal) {
                    gotFinal = true;
                    if (maxListenTimer) {
                        window.clearTimeout(maxListenTimer);
                        maxListenTimer = null;
                    }
                    try {
                        recognition.stop();
                    } catch {
                        // ignore
                    }
                    await sendTextMessage(transcript);
                }
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to process voice input');
            }
        };

        recognition.onerror = (event: any) => {
            const errorCode = (event?.error || '').toString();

            if (errorCode === 'no-speech') {
                // Sometimes this fires too quickly if the user starts speaking a moment late.
                // Retry once within a short window.
                const withinRetryWindow = Date.now() - startedAt < 8000;
                if (withinRetryWindow && retries < 1) {
                    retries += 1;
                    try {
                        recognition.stop();
                    } catch {
                        // ignore
                    }
                    window.setTimeout(() => {
                        try {
                            recognition.start();
                        } catch {
                            // ignore
                        }
                    }, 250);
                    return;
                }

                speechRecognitionFailuresRef.current += 1;
                if (speechRecognitionFailuresRef.current >= 2) {
                    disableSpeechRecognitionRef.current = true;
                }

                // Auto-fallback to backend transcription instead of looping on SpeechRecognition.
                usingSpeechRecognitionRef.current = false;
                speechRecognitionRef.current = null;
                setRecording(false);
                void startWavRecording();
                return;
            }

            if (errorCode === 'not-allowed' || errorCode === 'audio-capture') {
                toast({
                    title: 'Microphone blocked',
                    description: 'Please allow microphone access to use voice input.',
                    variant: 'destructive',
                });
                setError('Microphone access is blocked.');
                return;
            }

            const message = errorCode ? `Voice input error: ${errorCode}` : 'Voice input error';
            setError(message);
        };

        recognition.onend = () => {
            usingSpeechRecognitionRef.current = false;
            speechRecognitionRef.current = null;
            setRecording(false);

            // If SpeechRecognition ended without a final transcript, fall back to backend.
            if (!gotFinal) {
                speechRecognitionFailuresRef.current += 1;
                if (speechRecognitionFailuresRef.current >= 2) {
                    disableSpeechRecognitionRef.current = true;

            if (maxListenTimer) {
                window.clearTimeout(maxListenTimer);
                maxListenTimer = null;
            }
                }
                void startWavRecording();
            }
        };

        try {
            recognition.start();
            setRecording(true);

            // If SpeechRecognition stays “listening” forever (common on Windows),
            // stop it and fall back to backend WAV transcription.
            maxListenTimer = window.setTimeout(() => {
                if (!gotFinal) {
                    try {
                        recognition.stop();
                    } catch {
                        // ignore
                    }
                }
            }, 9000);

            // Stop listening after 10s to avoid getting stuck.
            window.setTimeout(() => {
                if (speechRecognitionRef.current === recognition) {
                    try {
                        recognition.stop();
                    } catch {
                        // ignore
                    }
                }
            }, 10000);
            return true;
        } catch {
            usingSpeechRecognitionRef.current = false;
            speechRecognitionRef.current = null;
            setRecording(false);
            return false;
        }
    };

    const startRecording = async () => {
        // Prefer SpeechRecognition when it works; auto-fallback to backend WAV transcription if it fails.
        if (await tryStartSpeechRecognition()) return;
        await startWavRecording();
    };

    const isSymptomQuery = (text: string) => symptomLikeRegex.test(text);

    const sendTextMessage = async (messageContentRaw: string) => {
        const messageContent = messageContentRaw.trim();
        if (!messageContent) return;

        const newUserMessage = appendToActiveChat('user', messageContent, { status: 'sent' });

        const nextMessages = [...messages, newUserMessage];
        setError(null);
        formRef.current?.reset();

        if (inputRef.current) {
            inputRef.current.focus({ preventScroll: true });
        }

        startTransition(async () => {
            try {
                // Add a 1-second delay for a more human-like feel
                await new Promise(resolve => setTimeout(resolve, 1000));

                let assistantText = '';

                if (isSymptomQuery(messageContent)) {
                    const fd = new FormData();
                    fd.set('message', messageContent);
                    const result = await symptomCheckChatAction(fd);
                    if (result.error) {
                        throw new Error(result.error);
                    }
                    assistantText = result.response || '';
                } else {
                    const formData = new FormData();
                    formData.set('message', messageContent);
                    formData.set('buddyPersona', JSON.stringify(persona));

                    const chatHistoryForAI = nextMessages
                        .filter(m => m.role === 'user' || m.role === 'model')
                        .map(m => ({ role: m.role, content: m.content }));
                    formData.set('chatHistory', JSON.stringify(chatHistoryForAI));

                    const currentUserData = { name: userData.name, streak: userData.streak };
                    formData.set('userData', JSON.stringify(currentUserData));

                    const result = await chatBuddyAction(formData);
                    if (result.error) {
                        throw new Error(result.error);
                    }
                    assistantText = result.response || '';
                }

                if (assistantText) {
                    // Mark the user message as read in UI.
                    setMessages(currentMessages => currentMessages.map(msg =>
                        msg.id === newUserMessage.id ? { ...msg, status: 'read' as const } : msg
                    ));

                    appendToActiveChat('assistant', assistantText);

                    setTimeout(() => {
                        if (inputRef.current && !isPending) {
                            inputRef.current.focus({ preventScroll: true });
                        }
                    }, 150);
                }
            } catch (error: any) {
                console.error('Error in chat action:', error);
                setError(error.message || 'An unexpected error occurred.');
                setMessages(currentMessages => currentMessages.map(msg =>
                    msg.id === newUserMessage.id ? { ...msg, status: 'sent' } : msg
                ));

                setTimeout(() => {
                    if (inputRef.current && !isPending) {
                        inputRef.current.focus({ preventScroll: true });
                    }
                }, 150);
            }
        });
    };
    
    const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const messageContent = formData.get('message') as string;
        await sendTextMessage(messageContent);
    };

    const cardVariants = {
        closed: { opacity: 0, y: 50, scale: 0.9 },
        open: { opacity: 1, y: 0, scale: 1 },
    }

    const ChatCard = (
        <Card className={cn(
            "flex flex-col",
            isEmbedded ? "h-[70vh] w-full" : (isMaximized ? "h-full w-full rounded-none" : "h-[60vh]")
        )}>
            <CardHeader className="flex flex-row items-center justify-between p-4">
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-border">
                        <AvatarImage src="/arohi-profile.png" alt={persona.name} />
                        <AvatarFallback>{persona.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className='grid gap-0.5'>
                        <h3 className="font-semibold">{persona.name}</h3>
                        <p className="text-xs text-muted-foreground">{persona.relationship}</p>
                    </div>
                </div>
                {!isEmbedded ? (
                    <div className='flex items-center gap-1'>
                        <Button variant="ghost" size="icon" onClick={() => setIsMaximized(p => !p)}><Maximize2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}><X className="h-4 w-4" /></Button>
                    </div>
                ) : null}
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-4">
                <ScrollArea className="h-full" viewportRef={scrollAreaViewportRef}>
                    <div className="space-y-4 pr-4">
                    {messages.map((msg, index) => {
                        const msgDate = new Date(msg.timestamp);
                        const prevMsgDate = index > 0 ? new Date(messages[index - 1].timestamp) : null;
                        const showDate = !prevMsgDate || msgDate.toDateString() !== prevMsgDate.toDateString();
                        
                        let dateLabel = '';
                        if (showDate) {
                            if (isToday(msgDate)) {
                                dateLabel = 'Today';
                            } else if (isYesterday(msgDate)) {
                                dateLabel = 'Yesterday';
                            } else {
                                dateLabel = format(msgDate, 'MMMM d, yyyy');
                            }
                        }

                        return(
                        <React.Fragment key={msg.id}>
                            {showDate && msg.role !== 'system' && (
                                <div className="my-4 flex justify-center">
                                    <div className="text-xs text-muted-foreground rounded-full bg-card border border-border px-3 py-1">
                                        {dateLabel}
                                    </div>
                                </div>
                            )}
                            <div className={cn("flex items-end gap-2", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                                {msg.role === 'model' && (
                                    <Avatar className='h-8 w-8 border border-border'>
                                        <AvatarImage src="/arohi-profile.png" alt={persona.name} />
                                        <AvatarFallback>{persona.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                )}
                                {msg.role !== 'system' ? (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className={cn(
                                            "group relative max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                                            msg.role === 'user'
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-card text-card-foreground border border-border'
                                        )}>
                                        <p style={{whiteSpace: 'pre-wrap'}} className="pb-4">{msg.content}</p>
                                        <div className={cn("absolute bottom-1 right-2 flex items-center gap-1 text-xs min-w-fit",
                                            msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                        )}>
                                            <span className="whitespace-nowrap">{format(new Date(msg.timestamp), 'HH:mm')}</span>
                                            {msg.role === 'user' && <MessageStatus status={msg.status} />}
                                        </div>
                                    </motion.div>
                                ) : (
                                    <div className="my-2 mx-auto max-w-sm rounded-2xl bg-card border border-border p-2 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                                        <Lock className="h-3 w-3 flex-shrink-0" />
                                        <p>{msg.content}</p>
                                    </div>
                                )}
                                {msg.role === 'user' && (
                                    <Avatar className='h-8 w-8 border border-border'>
                                        <AvatarImage src={userData.avatarUrl} alt={userData.name} />
                                        <AvatarFallback>{userData.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        </React.Fragment>
                    )})}
                    {isPending && (
                        <div className="flex items-end gap-2 justify-start">
                            <Avatar className='h-8 w-8 border border-border'>
                                <AvatarImage src="/arohi-profile.png" alt={persona.name} />
                                <AvatarFallback>{persona.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="max-w-[75%] rounded-2xl px-3 py-2 text-sm bg-card border border-border flex items-center gap-2">
                                <span className="text-muted-foreground">{persona.name} is typing...</span>
                            </div>
                        </div>
                    )}
                    </div>
                    {error && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </ScrollArea>
            </CardContent>
            <CardFooter className="p-4 pt-0">
                <form ref={formRef} onSubmit={handleFormSubmit} className="flex w-full items-center gap-2">
                    <Input ref={inputRef} name="message" placeholder="Type your message..." className="flex-1" autoComplete="off" disabled={isPending} />
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={isPending}
                        onClick={recording ? stopRecording : startRecording}
                    >
                        {recording ? (
                            <Square className="h-4 w-4 text-destructive" />
                        ) : (
                            <Mic className="h-4 w-4" />
                        )}
                    </Button>
                    <Button type="submit" size="icon" disabled={isPending}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </CardFooter>
        </Card>
    );

    const EmbeddedChat = (
        <div className="h-full w-full">
            <div className={cn(
                'grid h-full min-h-0 gap-6',
                showHistory ? 'lg:grid-cols-[260px_1fr_360px]' : 'lg:grid-cols-[1fr_360px]'
            )}>
                {showHistory ? (
                    <Card className="flex h-full min-h-0 flex-col rounded-2xl bg-card p-4 shadow-none border border-border">
                        <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                                <History className="h-4 w-4 text-muted-foreground" />
                                Chats
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-full hover:bg-white/[0.04]"
                                    onClick={() => {
                                        if (chats.length === 0) return;
                                        clearChatHistory();
                                    }}
                                    title="Clear history"
                                    disabled={chats.length === 0}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-full hover:bg-white/[0.04]"
                                    onClick={() => setShowHistory(false)}
                                    title="Close"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <ScrollArea className="flex-1 min-h-0" >
                            <div className="pt-3 space-y-1 pr-2">
                                {chats.length === 0 ? (
                                    <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                                        No chats yet.
                                    </div>
                                ) : (
                                    chats.map((c) => {
                                        const isActive = c.id === activeChatId;
                                        return (
                                            <div
                                                key={c.id}
                                                className={cn(
                                                    'group flex items-start gap-2 w-full rounded-xl px-3 py-2 border transition-colors',
                                                    isActive
                                                        ? 'bg-[hsl(var(--primary)/0.12)] border-primary/40'
                                                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                                                )}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveChatId(c.id)}
                                                    className="min-w-0 flex-1 text-left"
                                                >
                                                    <div className={cn('text-sm truncate', isActive ? 'text-foreground' : 'text-foreground/90')}>
                                                        {c.title || 'New Chat'}
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground mt-0.5">
                                                        {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                                                    </div>
                                                </button>

                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    className={cn(
                                                        'h-8 w-8 rounded-full hover:bg-white/[0.04] shrink-0',
                                                        'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                                                    )}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        deleteChat(c.id);
                                                    }}
                                                    title="Delete chat"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </ScrollArea>
                    </Card>
                ) : null}
                <Card className="flex h-full min-h-0 flex-col rounded-2xl bg-card p-6 shadow-none hover:shadow-none border border-border">
                    <div className="flex items-start justify-between gap-4 pb-6 border-b border-border">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16 border border-border">
                                <AvatarImage src="/arohi-profile.png" alt={persona.name} />
                                <AvatarFallback>{persona.name.charAt(0)}</AvatarFallback>
                            </Avatar>

                            <div className="grid gap-1">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-[18px] font-semibold text-foreground">{persona.name}</h2>
                                    <span className="h-2 w-2 rounded-full bg-primary" aria-label="Verified" />
                                </div>
                                <p className="text-[13px] text-muted-foreground">AI Health Assistant</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 text-muted-foreground">
                            <div className="flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/[0.06] px-3 py-1 text-xs">
                                <Flame className="h-4 w-4 text-primary" />
                                <span className="text-foreground/90">{typeof userData.streak === 'number' ? userData.streak : 0}</span>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-full hover:bg-white/[0.04]"
                                onClick={() => setShowHistory((v) => !v)}
                                title="Chat history"
                            >
                                <History className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-white/[0.04]">
                                <Bell className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-hidden pt-6">
                        <ScrollArea className="h-full" viewportRef={scrollAreaViewportRef}>
                            <div className="space-y-4 pr-4">
                                {!hasConversation ? (
                                    <>
                                        <div className="flex items-start gap-3">
                                            <div className="max-w-[75%] bg-accent px-[18px] py-[14px] text-foreground rounded-[14px] rounded-bl-[4px]">
                                                <p className="text-sm leading-relaxed">Hi! I’m {persona.name}, your AI health assistant. How can I assist you today?</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2 pt-2">
                                            {quickPrompts.map((p) => (
                                                <button
                                                    key={p.text}
                                                    type="button"
                                                    onClick={() => void sendTextMessage(p.text)}
                                                    className="w-full text-left rounded-[12px] px-[14px] py-[10px] bg-white/[0.04] border border-white/[0.06] text-muted-foreground transition-colors duration-200 hover:bg-[hsl(var(--primary)/0.12)] hover:text-primary hover:border-primary/40"
                                                >
                                                    <span className="mr-2">{p.icon}</span>
                                                    {p.text}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : null}

                                {messages.map((msg, index) => {
                                    if (msg.role === 'system') return null;

                                    const msgDate = new Date(msg.timestamp);
                                    const prevMsgDate = index > 0 ? new Date(messages[index - 1].timestamp) : null;
                                    const showDate = !prevMsgDate || msgDate.toDateString() !== prevMsgDate.toDateString();

                                    let dateLabel = '';
                                    if (showDate) {
                                        if (isToday(msgDate)) {
                                            dateLabel = 'Today';
                                        } else if (isYesterday(msgDate)) {
                                            dateLabel = 'Yesterday';
                                        } else {
                                            dateLabel = format(msgDate, 'MMMM d, yyyy');
                                        }
                                    }

                                    return (
                                        <React.Fragment key={msg.id}>
                                            {showDate ? (
                                                <div className="my-4 flex justify-center">
                                                    <div className="text-xs text-muted-foreground rounded-full bg-white/[0.04] border border-white/[0.06] px-3 py-1">
                                                        {dateLabel}
                                                    </div>
                                                </div>
                                            ) : null}

                                            <div className={cn("flex items-end gap-2", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                                                {msg.role === 'model' ? (
                                                    <Avatar className="h-8 w-8 border border-border">
                                                        <AvatarImage src="/arohi-profile.png" alt={persona.name} />
                                                        <AvatarFallback>{persona.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                ) : null}

                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className={cn(
                                                        "group relative max-w-[75%] px-4 py-3 text-sm",
                                                        msg.role === 'user'
                                                            ? 'bg-primary text-primary-foreground rounded-[14px] rounded-br-[4px]'
                                                            : 'bg-accent text-foreground rounded-[14px] rounded-bl-[4px]'
                                                    )}
                                                >
                                                    <p style={{ whiteSpace: 'pre-wrap' }} className="pb-4 leading-relaxed">{msg.content}</p>
                                                    <div
                                                        className={cn(
                                                            "absolute bottom-1 right-3 flex items-center gap-1 text-xs min-w-fit",
                                                            msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                                        )}
                                                    >
                                                        <span className="whitespace-nowrap">{format(new Date(msg.timestamp), 'HH:mm')}</span>
                                                        {msg.role === 'user' ? <MessageStatus status={msg.status} /> : null}
                                                    </div>
                                                </motion.div>

                                                {msg.role === 'user' ? (
                                                    <Avatar className="h-8 w-8 border border-border">
                                                        <AvatarImage src={userData.avatarUrl} alt={userData.name} />
                                                        <AvatarFallback>{userData.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                ) : null}
                                            </div>
                                        </React.Fragment>
                                    );
                                })}

                                {isPending ? (
                                    <div className="flex items-end gap-2 justify-start">
                                        <Avatar className="h-8 w-8 border border-border">
                                            <AvatarImage src="/arohi-profile.png" alt={persona.name} />
                                            <AvatarFallback>{persona.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="max-w-[75%] rounded-[14px] rounded-bl-[4px] px-4 py-3 text-sm bg-accent">
                                            <span className="text-muted-foreground">{persona.name} is typing...</span>
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            {error ? (
                                <Alert variant="destructive" className="mt-4">
                                    <AlertTitle>Error</AlertTitle>
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            ) : null}
                        </ScrollArea>
                    </div>

                    <div className="mt-4 rounded-[14px] bg-card border border-border px-4 py-3 focus-within:border-primary">
                        <form ref={formRef} onSubmit={handleFormSubmit} className="flex items-center gap-2">
                            <Input
                                ref={inputRef}
                                name="message"
                                placeholder="Type your message..."
                                autoComplete="off"
                                disabled={isPending}
                                className="flex-1 bg-transparent border-0 px-0 py-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                            />

                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-10 w-10 rounded-full hover:bg-white/[0.04]"
                                disabled={isPending}
                                onClick={recording ? stopRecording : startRecording}
                            >
                                {recording ? (
                                    <Square className="h-4 w-4 text-destructive" />
                                ) : (
                                    <Mic className="h-4 w-4" />
                                )}
                            </Button>

                            <Button
                                type="submit"
                                size="icon"
                                disabled={isPending}
                                className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:translate-y-0 active:translate-y-0"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </div>
                </Card>

                <Card className="hidden lg:flex h-full min-h-0 flex-col rounded-2xl bg-accent p-4 shadow-none hover:shadow-none border border-border">
                    <div className="rounded-2xl overflow-hidden border border-border bg-background">
                        <div className="relative aspect-[4/3] w-full">
                            <Image src="/arohi.png" alt="Aarohi" fill className="object-cover" priority />
                        </div>
                    </div>

                    <div className="pt-4">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-border">
                                <AvatarImage src="/arohi-profile.png" alt={persona.name} />
                                <AvatarFallback>{persona.name.charAt(0)}</AvatarFallback>
                            </Avatar>

                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold text-foreground truncate">{persona.name}</p>
                                    <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                                    <span className="h-2 w-2 rounded-full bg-primary" aria-label="Verified" />
                                </div>
                                <p className="text-xs text-muted-foreground">AI Health Assistant</p>
                            </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 rounded-full bg-white/[0.04] border border-white/[0.06] px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <Flame className="h-4 w-4 text-primary flex-shrink-0" aria-hidden="true" />
                                <p className="text-xs text-muted-foreground truncate">Might occasionally roast you, but only out of love</p>
                            </div>
                            <p className="text-xs text-muted-foreground whitespace-nowrap">{userData.streak ?? 0}</p>
                        </div>

                        <div className="my-4 h-px bg-white/[0.06]" />

                        <div className="rounded-[14px] bg-white/[0.04] border border-white/[0.06] p-4">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Hey there! I&apos;m {persona.name}, your wellness buddy. Here to help you achieve your health goals.
                                <br />
                                Ask me anything!
                            </p>
                        </div>

                        {/* Suggestions removed per dashboard spec */}
                    </div>
                </Card>
            </div>
        </div>
    );

    return (
        <>
            {isEmbedded ? EmbeddedChat : (
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            variants={cardVariants}
                            initial="closed"
                            animate="open"
                            exit="closed"
                            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                            className={cn(
                                "fixed z-50",
                                isMaximized 
                                    ? "inset-0" 
                                    : "bottom-24 right-4 w-full max-w-sm"
                            )}
                        >
                            {ChatCard}
                        </motion.div>
                    )}
                </AnimatePresence>
            )}

            {!hideLauncher ? (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 20 }}
                                className="fixed bottom-4 right-4 z-40"
                            >
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-14 w-14 rounded-full shadow-lg p-0 overflow-hidden bg-transparent hover:bg-transparent"
                                    onClick={() => setIsOpen(p => !p)}
                                >
                                    <AnimatePresence mode="wait">
                                        {isOpen ? (
                                            <motion.div key="close" initial={{ rotate: 45, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -45, opacity: 0 }}>
                                                <X className="h-6 w-6" />
                                            </motion.div>
                                        ) : (
                                            <motion.div key="open" initial={{ rotate: 45, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -45, opacity: 0 }}>
                                                <Avatar className="h-14 w-14 border-0">
                                                    <AvatarImage src="/arohi-profile.png" alt={persona.name} />
                                                    <AvatarFallback>{persona.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </Button>
                            </motion.div>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                            {isOpen ? 'Close Chatbot' : 'Open Chatbot'}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ) : null}


        </>
    );
}

