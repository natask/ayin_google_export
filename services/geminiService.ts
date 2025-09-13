import { GoogleGenAI, Modality } from "@google/genai";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Use the native audio output model as requested in the user's example
const model = "gemini-2.5-flash-preview-native-audio-dialog";

// Use the more detailed system instruction from the original app, as it's tailored to the use case
const systemInstruction = `You are Ayin, a friendly and hyper-terse and to the point AI assistant for users who are blind or have low vision. Your primary function is to be their eyes. You will receive an image and a user's spoken request. Analyze both inputs to understand the user's environment and their request. Describe the world in quickly tersely. the user will and maay ask clarifying questions.  Your tone should always be calm, reassuring, and helpful. If the user doesn't ask a specific question, say something if you something dangeroush or something the user should pay atention to in the video stream quickly, efficiently and tersely.`;


const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

// --- Gemini Live Service ---
// This service manages the connection to the Gemini Live API based on the user's provided example.

interface LiveCallbacks {
    onOpen: () => void;
    onError: (e: Error) => void;
    onAudioChunk: (chunk: ArrayBuffer) => void;
    onTurnComplete: () => void;
}

class GeminiLiveService {
    private session: any | null = null; // Type would be ConnectionSession, but it's not exported.
    private _isConnected = false;

    public isConnected(): boolean {
        return this._isConnected;
    }

    public async connect(callbacks: LiveCallbacks) {
        if (this.session) {
            console.log("Already connected.");
            return;
        }

        const config = {
            responseModalities: [Modality.AUDIO],
            systemInstruction: systemInstruction
        };

        try {
            this.session = await ai.live.connect({
                model: model,
                config: config,
                callbacks: {
                    onopen: () => {
                        console.debug('Gemini Live: Connection opened.');
                        this._isConnected = true;
                        callbacks.onOpen();
                    },
                    onmessage: (message: any) => {
                        // Handle incoming audio data
                        if (message.data) {
                            const audioBuffer = base64ToArrayBuffer(message.data);
                            callbacks.onAudioChunk(audioBuffer);
                        }
                        // Handle end of turn
                        if (message.serverContent && message.serverContent.turnComplete) {
                            console.debug('Gemini Live: Turn complete.');
                            callbacks.onTurnComplete();
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Gemini Live: Error:', e);
                        this._isConnected = false;
                        this.session = null;
                        callbacks.onError(new Error(e.message || "An unknown live connection error occurred."));
                    },
                    onclose: (e: any) => {
                        console.debug('Gemini Live: Connection closed.', e?.reason);
                        this._isConnected = false;
                        this.session = null;
                    },
                },
            });
        } catch (e) {
            console.error("Failed to connect to Gemini Live service:", e);
            callbacks.onError(e as Error);
        }
    }

    public disconnect() {
        if (this.session) {
            this.session.close();
            this.session = null;
            this._isConnected = false;
            console.log("Gemini Live: Disconnected.");
        }
    }

    public sendRealtimeInput(input: { image?: { data: string | null }; audio?: { data: string | null }; }) {
        if (!this.session || !this._isConnected) {
            console.warn("Gemini Live: Not connected, cannot send input.");
            return;
        }

        const payload: any = {};
        if (input.audio?.data) {
            payload.audio = {
                data: input.audio.data,
                mimeType: "audio/pcm;rate=16000"
            };
        }
        if (input.image?.data) {
            payload.image = {
                data: input.image.data,
                mimeType: "image/jpeg"
            };
        }

        if (Object.keys(payload).length > 0) {
            this.session.sendRealtimeInput(payload);
        }
    }

    public finishTurn() {
        // In this interactive model, simply stopping the stream of audio/video from the client
        // is the signal that the user's turn is over. The server detects this and then
        // processes the full turn. This function is a logical placeholder called by the hook
        // to manage its own state (e.g., from LISTENING to PROCESSING).
        console.debug("Gemini Live: User turn finished.");
    }
}

// Export a singleton instance of the service
export const geminiLiveService = new GeminiLiveService();