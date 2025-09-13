import { useState, useRef, useCallback, useEffect } from 'react';
import { AssistantState } from '../types';
import { geminiLiveService } from '../services/geminiService';

// --- Web Audio Player for Raw PCM Chunks ---
class PcmPlayer {
    private audioContext: AudioContext;
    private sampleRate: number;
    private nextPlayTime = 0; // Time tracking for seamless scheduling

    constructor(sampleRate = 24000) { // Gemini audio output is 24kHz
        this.audioContext = new AudioContext({ sampleRate });
        this.sampleRate = sampleRate;
        // Start suspended to comply with browser autoplay policies.
        this.audioContext.suspend();
    }

    public playChunk(audioData: ArrayBuffer) {
        // Resume context on user gesture (which is implicitly when audio starts playing).
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const pcmData = new Int16Array(audioData);
        const float32Data = new Float32Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
            // Normalize the 16-bit PCM data to the -1.0 to 1.0 range for Web Audio API.
            float32Data[i] = pcmData[i] / 32768.0;
        }

        const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, this.sampleRate);
        audioBuffer.copyToChannel(float32Data, 0);

        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);

        const currentTime = this.audioContext.currentTime;
        
        // If nextPlayTime is in the past, reset it to now. This handles the start of playback.
        if (this.nextPlayTime < currentTime) {
            this.nextPlayTime = currentTime;
        }

        // Schedule the source to start playing at the calculated time, ensuring no gaps.
        source.start(this.nextPlayTime);

        // Update the time for the start of the next chunk.
        this.nextPlayTime += audioBuffer.duration;
    }

    public stop() {
        // Resetting nextPlayTime is crucial when the user interrupts.
        this.nextPlayTime = 0;
        // Suspend the context to save resources when not actively playing.
        if (this.audioContext.state === 'running') {
            this.audioContext.suspend();
        }
    }
}


// --- Frame Capture Logic ---
const captureFrameAsBase64 = (videoElement: HTMLVideoElement): string | null => {
    // Add check for videoWidth to prevent capturing blank frames before video is ready
    if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    return dataUrl.split(',')[1] ?? null;
};

// --- Audio Processing and Encoding Helpers ---
const TARGET_SAMPLE_RATE = 16000;

const downsampleBuffer = (buffer: Float32Array, inputSampleRate: number, outputSampleRate: number): Float32Array => {
    if (inputSampleRate === outputSampleRate) {
        return buffer;
    }
    const sampleRateRatio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        let accum = 0, count = 0;
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
        }
        result[offsetResult] = accum / count;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    return result;
};

const pcm16bitFromFloat32 = (input: Float32Array): Int16Array => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
};

const pcm16ToBase64 = (pcm16: Int16Array): string => {
    const buffer = pcm16.buffer;
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

// Barge-in detection threshold. This is empirical and may need tuning.
const BARGE_IN_RMS_THRESHOLD = 0.02;

// --- Main Hook ---
interface UseVoiceAssistantProps {
    videoRef: React.RefObject<HTMLVideoElement>;
}

export const useVoiceAssistant = ({ videoRef }: UseVoiceAssistantProps) => {
    const [state, setState] = useState<AssistantState>(AssistantState.IDLE);
    const [error, setError] = useState('');
    
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);
    
    const audioStreamRef = useRef<MediaStream | null>(null);
    const videoStreamRef = useRef<MediaStream | null>(null);
    const videoFrameRequestRef = useRef<number | null>(null);
    const audioPlayerRef = useRef<PcmPlayer | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const isBargedInRef = useRef(false);

    const videoLoop = useCallback(() => {
        if (stateRef.current === AssistantState.LISTENING && videoRef.current) {
            const frame = captureFrameAsBase64(videoRef.current);
            if (frame) {
                geminiLiveService.sendRealtimeInput({ image: { data: frame } });
            }
        }
        videoFrameRequestRef.current = requestAnimationFrame(videoLoop);
    }, [videoRef]);


    const startStreaming = useCallback(() => {
        if (!audioStreamRef.current || !geminiLiveService.isConnected()) {
            console.warn("Attempted to stream before ready.");
            return;
        }

        audioPlayerRef.current?.stop();

        // Setup Web Audio API for continuous raw PCM streaming
        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
        if (!sourceNodeRef.current) {
            sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(audioStreamRef.current);
        }
        
        const bufferSize = 4096;
        scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);
        
        scriptProcessorRef.current.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            
            // Check for barge-in if the assistant is speaking
            if (stateRef.current === AssistantState.SPEAKING) {
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) { sum += inputData[i] * inputData[i]; }
                const rms = Math.sqrt(sum / inputData.length);

                if (rms > BARGE_IN_RMS_THRESHOLD && !isBargedInRef.current) {
                    console.log("Barge-in detected.");
                    isBargedInRef.current = true; // Set flag to handle state transition correctly
                    audioPlayerRef.current?.stop();
                    setState(AssistantState.LISTENING);
                }
            }
            
            const downsampled = downsampleBuffer(inputData, audioContextRef.current!.sampleRate, TARGET_SAMPLE_RATE);
            const pcm16 = pcm16bitFromFloat32(downsampled);
            const base64Audio = pcm16ToBase64(pcm16);

            geminiLiveService.sendRealtimeInput({ audio: { data: base64Audio } });

        };
        sourceNodeRef.current.connect(scriptProcessorRef.current);
        scriptProcessorRef.current.connect(audioContextRef.current.destination);

        // Start video streaming loop
        if (videoRef.current) {
            videoFrameRequestRef.current = requestAnimationFrame(videoLoop);
        }

    }, [videoRef, videoLoop]);

    useEffect(() => {
        audioPlayerRef.current = new PcmPlayer();
        const getPermissionsAndConnect = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: true, 
                    video: { facingMode: 'environment' } 
                });
                audioStreamRef.current = new MediaStream([stream.getAudioTracks()[0]]);
                videoStreamRef.current = new MediaStream([stream.getVideoTracks()[0]]);

                if (videoRef.current) {
                    videoRef.current.srcObject = videoStreamRef.current;
                }
                
                geminiLiveService.connect({
                    onOpen: () => {
                        startStreaming();
                        setState(AssistantState.LISTENING);
                    },
                    onError: (e) => {
                        setError("Connection error. Please refresh.");
                        setState(AssistantState.ERROR);
                    },
                    onAudioChunk: (chunk) => {
                        // If a barge-in just occurred, the first new audio chunk marks the start
                        // of the new response. We can now safely switch to SPEAKING state.
                        if (isBargedInRef.current) {
                            isBargedInRef.current = false;
                            setState(AssistantState.SPEAKING);
                        } else if (stateRef.current !== AssistantState.SPEAKING) {
                           // This is the normal flow for the first chunk of a response
                           setState(AssistantState.SPEAKING);
                        }
                        
                        // Only play audio if we are in the SPEAKING state. This prevents
                        // playing trailing audio chunks from an interrupted response.
                        if (stateRef.current === AssistantState.SPEAKING) {
                           audioPlayerRef.current?.playChunk(chunk);
                        }
                    },
                    onTurnComplete: () => {
                        isBargedInRef.current = false; // Reset barge-in state on turn completion
                        setState(AssistantState.LISTENING);
                    }
                });
            } catch (err) {
                console.error("Permissions error:", err);
                setError("Microphone and camera access denied.");
                setState(AssistantState.PERMISSIONS_ERROR);
            }
        };
        
        getPermissionsAndConnect();

        return () => {
            geminiLiveService.disconnect();
            if (videoFrameRequestRef.current) cancelAnimationFrame(videoFrameRequestRef.current);
            audioStreamRef.current?.getTracks().forEach(track => track.stop());
            videoStreamRef.current?.getTracks().forEach(track => track.stop());
            sourceNodeRef.current?.disconnect();
            scriptProcessorRef.current?.disconnect();
            audioContextRef.current?.close().catch(console.error);
        };
    }, [videoRef, startStreaming, videoLoop]);

    return {
        state,
        error,
        transcript: '', 
    };
};