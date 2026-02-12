import { useState, useEffect, useRef, useCallback } from 'react';
import { databases, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import { ID, Query } from 'appwrite';
import { useAuth } from '../context/AuthContext';
import {
    MessageCircle, X, Send, Mic, MicOff, Bot, User as UserIcon,
    Loader2, Sparkles, Volume2, VolumeX, Trash2
} from 'lucide-react';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GEMINI_TTS_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';

// Helper: wrap raw PCM16 LE data in a WAV container so <audio> can play it
function createWavFromPCM(pcmBytes, sampleRate = 24000) {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmBytes.length;
    const buf = new ArrayBuffer(44 + dataSize);
    const v = new DataView(buf);
    const w = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + dataSize, true); w(8, 'WAVE');
    w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, numChannels, true); v.setUint32(24, sampleRate, true);
    v.setUint32(28, byteRate, true); v.setUint16(32, blockAlign, true);
    v.setUint16(34, bitsPerSample, true);
    w(36, 'data'); v.setUint32(40, dataSize, true);
    new Uint8Array(buf).set(pcmBytes, 44);
    return buf;
}

export default function ChatBot() {
    const { user, userRole, hasPermission } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: `Hi ${user?.name?.split(' ')[0] || 'there'}! 👋 I'm **TDo**, your AI assistant. I can help you with:\n\n• 📋 Task status & details\n• 📅 Leave requests & status\n• 📊 Project updates\n• ⏰ Attendance info\n• 🎯 And much more!\n\nJust ask me anything or use the mic button to speak!`
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [pulse, setPulse] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const recognitionRef = useRef(null);
    const isRecordingRef = useRef(false);
    const audioRef = useRef(null);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
    }, [isOpen]);

    // Pulse FAB
    useEffect(() => {
        const t = setInterval(() => { setPulse(true); setTimeout(() => setPulse(false), 1000); }, 5000);
        return () => clearInterval(t);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        };
    }, []);

    // ─── Gemini TTS (natural voice) ───
    const speakText = useCallback(async (text) => {
        if (!ttsEnabled || !text || !GEMINI_API_KEY) return;

        // Stop currently playing audio
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

        // Clean text
        const cleanText = text
            .replace(/<<<ACTION:.*?>>>/gs, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/[•📋📅📊⏰🎯✅❌🧹👋🔥⚡⚖️🌿🏖️🎤🧾💼📝🗓️]/gu, '')
            .replace(/\n+/g, '. ')
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleanText || cleanText.length < 2) return;
        setIsSpeaking(true);

        try {
            const res = await fetch(`${GEMINI_TTS_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: cleanText }] }],
                    generationConfig: {
                        responseModalities: ['AUDIO'],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: { voiceName: 'Orus' }
                            }
                        }
                    }
                })
            });

            if (!res.ok) {
                console.error('TDo TTS HTTP error:', res.status);
                throw new Error('TTS API error');
            }

            const data = await res.json();
            const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (!part?.inlineData?.data) throw new Error('No audio in response');

            const mime = part.inlineData.mimeType || 'audio/L16;rate=24000';
            const raw = atob(part.inlineData.data);
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

            // Build a playable blob
            let blob;
            if (mime.includes('L16') || mime.includes('pcm') || mime.includes('raw')) {
                const rate = parseInt((mime.match(/rate=(\d+)/) || [])[1]) || 24000;
                blob = new Blob([createWavFromPCM(bytes, rate)], { type: 'audio/wav' });
            } else {
                blob = new Blob([bytes], { type: mime });
            }

            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;

            audio.onended = () => { setIsSpeaking(false); audioRef.current = null; URL.revokeObjectURL(url); };
            audio.onerror = () => { setIsSpeaking(false); audioRef.current = null; URL.revokeObjectURL(url); };

            await audio.play();
            console.log('TDo: speaking via Gemini TTS (' + mime + ')');

        } catch (err) {
            console.error('TDo TTS error:', err);
            setIsSpeaking(false);
        }
    }, [ttsEnabled]);

    const toggleTts = () => {
        if (ttsEnabled) {
            if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
            setIsSpeaking(false);
        }
        setTtsEnabled(prev => !prev);
    };

    // ─── Fetch User Context ───
    const fetchUserContext = useCallback(async () => {
        try {
            const queries = [Query.limit(100)];
            const userQ = [Query.equal('assigneeId', user?.$id || ''), Query.limit(100)];
            const leaveQ = [Query.equal('userId', user?.$id || ''), Query.limit(50)];

            const results = await Promise.allSettled([
                databases.listDocuments(DATABASE_ID, COLLECTIONS.TASKS, userQ),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, queries),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.LEAVES, leaveQ),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.ATTENDANCE, [
                    Query.equal('userId', user?.$id || ''), Query.limit(30), Query.orderDesc('$createdAt')
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.TASK_STATUSES, [Query.orderAsc('order')]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.TEAM_MEMBERS, queries),
            ]);

            const [tasksR, projR, leaveR, attR, statusR, memberR] = results;
            const tasks = tasksR.status === 'fulfilled' ? tasksR.value.documents : [];
            const projects = projR.status === 'fulfilled' ? projR.value.documents : [];
            const leaves = leaveR.status === 'fulfilled' ? leaveR.value.documents : [];
            const attendance = attR.status === 'fulfilled' ? attR.value.documents : [];
            const statuses = statusR.status === 'fulfilled' ? statusR.value.documents : [];
            const members = memberR.status === 'fulfilled' ? memberR.value.documents : [];

            return {
                tasks: tasks.map(t => ({ title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, projectId: t.projectId, estimatedHours: t.estimatedHours, description: t.description?.substring(0, 200) })),
                projects: projects.map(p => ({ id: p.$id, name: p.name, description: p.description?.substring(0, 150), status: p.status })),
                leaves: leaves.map(l => ({ type: l.type, startDate: l.startDate, endDate: l.endDate, status: l.status, reason: l.reason })),
                attendance: attendance.slice(0, 10).map(a => ({ date: a.date || a.$createdAt, checkIn: a.checkIn, checkOut: a.checkOut, status: a.status })),
                statuses: statuses.map(s => s.name),
                members: members.map(m => ({ name: m.name, email: m.email, position: m.position })),
                userRole: userRole?.name || 'Unknown',
                userName: user?.name || 'Unknown',
                userEmail: user?.email || 'Unknown',
                todayDate: new Date().toISOString().split('T')[0],
                permissions: hasPermission('manage_tasks') ? 'Manager' : 'Employee'
            };
        } catch (error) {
            console.error('Context fetch error:', error);
            return { error: 'Could not fetch data' };
        }
    }, [user, userRole, hasPermission]);

    // ─── Actions ───
    const executeAction = async (action) => {
        try {
            if (action.type === 'create_leave') {
                await databases.createDocument(DATABASE_ID, COLLECTIONS.LEAVES, ID.unique(), {
                    userId: user.$id, userName: user.name,
                    startDate: action.startDate, endDate: action.endDate,
                    type: action.leaveType || 'casual',
                    reason: action.reason || 'Requested via TDo chatbot',
                    status: 'pending'
                });
                return '✅ Leave request created successfully! Your request is now pending approval.';
            }
            return null;
        } catch (error) {
            return '❌ Failed to perform action: ' + (error?.message || error);
        }
    };

    // ─── Send Message ───
    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || loading) return;

        setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
        setInput('');
        if (inputRef.current) inputRef.current.style.height = 'auto';
        setLoading(true);

        try {
            const ctx = await fetchUserContext();

            const systemPrompt = `You are TDo, a friendly and helpful AI assistant for the TeamToDo project management application. Your name is TDo (short for TeamToDo).

CURRENT USER CONTEXT:
- Name: ${ctx.userName}
- Email: ${ctx.userEmail}
- Role: ${ctx.userRole}
- Access Level: ${ctx.permissions}
- Today's Date: ${ctx.todayDate}

USER'S TASKS (${ctx.tasks?.length || 0} total):
${JSON.stringify(ctx.tasks || [], null, 1)}

PROJECTS (${ctx.projects?.length || 0}):
${JSON.stringify(ctx.projects || [], null, 1)}

USER'S LEAVES:
${JSON.stringify(ctx.leaves || [], null, 1)}

RECENT ATTENDANCE:
${JSON.stringify(ctx.attendance || [], null, 1)}

TASK STATUSES: ${(ctx.statuses || []).join(', ')}

TEAM MEMBERS:
${JSON.stringify(ctx.members || [], null, 1)}

CAPABILITIES:
You can perform the following ACTIONS by including a JSON action block in your response:
1. Create leave request: Include this exact JSON block in your response when the user wants to apply for leave:
   <<<ACTION:{"type":"create_leave","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","leaveType":"casual|sick|annual","reason":"reason text"}>>>

RULES:
- Be conversational, friendly, and concise
- Use emojis sparingly to make responses feel warm
- When asked about tasks, provide specific details from the context
- When asked to create a leave, confirm the dates and type with the user before including the ACTION block. If dates are clear, proceed directly.
- Format responses with markdown for readability
- If you don't have enough data to answer, say so honestly
- Keep responses short and to the point (max 3-4 paragraphs)
- For leave requests: casual, sick, annual are the available types
- When mentioning dates, use a human-friendly format (e.g., "Feb 15, 2026")
- Never reveal raw JSON data — present information in a clean, human-readable way`;

            const history = messages.slice(-8).map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: [...history, { role: 'user', parts: [{ text: trimmed }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData?.error?.message || `API error: ${response.status}`);
            }

            const data = await response.json();
            const parts = data.candidates?.[0]?.content?.parts || [];
            let aiText = '';
            for (let i = parts.length - 1; i >= 0; i--) {
                if (parts[i].text) { aiText = parts[i].text; break; }
            }

            const actionMatch = aiText.match(/<<<ACTION:(.*?)>>>/s);
            let actionResult = null;
            if (actionMatch) {
                try { actionResult = await executeAction(JSON.parse(actionMatch[1])); } catch (e) { }
                aiText = aiText.replace(/<<<ACTION:.*?>>>/s, '').trim();
            }
            if (actionResult) aiText = aiText + '\n\n' + actionResult;

            const finalText = aiText || "I'm sorry, I couldn't process that. Could you try again?";
            setMessages(prev => [...prev, { role: 'assistant', content: finalText }]);

            // Speak (fire-and-forget — don't await so UI stays responsive)
            speakText(finalText);

        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `❌ Sorry, I encountered an error: ${error.message}. Please try again.`
            }]);
        } finally {
            setLoading(false);
        }
    };

    // ─── Voice Recording ───
    const toggleRecording = () => { isRecording ? stopRecording() : startRecording(); };

    const startRecording = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            setMessages(prev => [...prev, { role: 'assistant', content: '🎤 Voice input is not supported in this browser. Please use Chrome or Edge.' }]);
            return;
        }

        // Stop TTS while recording
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        setIsSpeaking(false);

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        let finalTranscript = '';

        recognition.onstart = () => { setIsRecording(true); isRecordingRef.current = true; finalTranscript = ''; };

        recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const t = event.results[i][0].transcript;
                if (event.results[i].isFinal) { finalTranscript += t + ' '; } else { interim = t; }
            }
            setInput(finalTranscript + interim);
        };

        recognition.onerror = (event) => {
            if (event.error === 'no-speech' || event.error === 'aborted') return;
            setIsRecording(false); isRecordingRef.current = false;
            if (event.error === 'not-allowed') {
                setMessages(prev => [...prev, { role: 'assistant', content: '🎤 Microphone access denied. Please allow microphone access in your browser settings.' }]);
            }
        };

        recognition.onend = () => {
            if (isRecordingRef.current && recognitionRef.current) {
                try { recognition.start(); return; } catch (e) { }
            }
            setIsRecording(false); isRecordingRef.current = false;
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    const stopRecording = () => {
        isRecordingRef.current = false;
        const r = recognitionRef.current; recognitionRef.current = null;
        if (r) { try { r.stop(); } catch (e) { } }
        setIsRecording(false);
    };

    // ─── Auto-resize textarea ───
    const handleInputChange = (e) => {
        setInput(e.target.value);
        const el = e.target; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    };

    const handleKeyPress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

    const clearChat = () => {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        setIsSpeaking(false);
        setMessages([{ role: 'assistant', content: `Chat cleared! 🧹 How can I help you, ${user?.name?.split(' ')[0] || 'there'}?` }]);
    };

    const renderMessage = (content) => {
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-xs">$1</code>')
            .replace(/\n/g, '<br/>');
    };

    return (
        <>
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className={`fixed bottom-6 right-6 h-14 w-14 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-full shadow-xl shadow-indigo-300/50 flex items-center justify-center text-white hover:shadow-2xl hover:shadow-indigo-400/50 hover:scale-110 transition-all duration-300 z-50 ${pulse ? 'animate-pulse' : ''}`}
                    title="Chat with TDo"
                >
                    <div className="relative">
                        <MessageCircle className="h-6 w-6" />
                        <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-400 rounded-full border-2 border-indigo-600 animate-pulse"></div>
                    </div>
                </button>
            )}

            {isOpen && (
                <div className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden"
                    style={{ animation: 'slideUp 0.3s ease-out' }}>

                    {/* Header */}
                    <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <Bot className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-sm">TDo Assistant</h3>
                                <p className="text-indigo-200 text-[10px] flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block"></span>
                                    Online · Ready to help
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={toggleTts}
                                className={`p-2 rounded-lg transition-colors ${ttsEnabled
                                    ? 'text-white bg-white/15 hover:bg-white/25'
                                    : 'text-white/40 hover:text-white/70 hover:bg-white/10'
                                    }`}
                                title={ttsEnabled ? 'Voice responses ON' : 'Voice responses OFF'}>
                                {ttsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                            </button>
                            <button onClick={clearChat}
                                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                title="Clear chat">
                                <Trash2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => setIsOpen(false)}
                                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                title="Close chat">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50/80">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === 'assistant'
                                    ? 'bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm'
                                    : 'bg-gradient-to-br from-gray-600 to-gray-700 shadow-sm'
                                    }`}>
                                    {msg.role === 'assistant'
                                        ? <Sparkles className="h-3.5 w-3.5 text-white" />
                                        : <UserIcon className="h-3.5 w-3.5 text-white" />
                                    }
                                </div>
                                <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.role === 'assistant'
                                    ? 'bg-white text-gray-800 border border-gray-100 shadow-sm rounded-tl-md'
                                    : 'bg-indigo-600 text-white rounded-tr-md'
                                    }`}
                                    dangerouslySetInnerHTML={{ __html: renderMessage(msg.content) }}
                                />
                            </div>
                        ))}

                        {loading && (
                            <div className="flex gap-2.5">
                                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                                    <Sparkles className="h-3.5 w-3.5 text-white" />
                                </div>
                                <div className="bg-white border border-gray-100 shadow-sm px-4 py-3 rounded-2xl rounded-tl-md">
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="border-t border-gray-100 px-4 py-3 bg-white flex-shrink-0">
                        {isRecording && (
                            <div className="mb-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-600 font-medium">
                                <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></div>
                                Listening... Speak freely, tap mic to stop
                            </div>
                        )}
                        {isSpeaking && (
                            <div className="mb-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-2 text-xs text-indigo-600 font-medium">
                                <Volume2 className="h-3 w-3 animate-pulse" />
                                TDo is speaking...
                            </div>
                        )}
                        <div className="flex items-end gap-2">
                            <button onClick={toggleRecording}
                                className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${isRecording
                                    ? 'bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                                    }`}
                                title={isRecording ? 'Stop recording' : 'Voice input'}>
                                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                            </button>
                            <div className="flex-1">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={handleInputChange}
                                    onKeyDown={handleKeyPress}
                                    placeholder="Ask TDo anything..."
                                    rows={1}
                                    className="w-full resize-none border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 bg-gray-50/50 transition-all overflow-hidden"
                                    style={{ minHeight: '40px', maxHeight: '120px' }}
                                    disabled={loading}
                                />
                            </div>
                            <button onClick={handleSend}
                                disabled={!input.trim() || loading}
                                className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${input.trim() && !loading
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    }`}>
                                <Send className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </>
    );
}
