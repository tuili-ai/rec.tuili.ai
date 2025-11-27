import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, PCM_SAMPLE_RATE } from './audioUtils';
import { AiFeature } from '../types';

interface LiveSessionCallbacks {
  onInterviewerQuestion: (text: string) => void;
  onTranscriptUpdate: (text: string) => void;
  onOpen: () => void;
  onError: (e: Error) => void;
}

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private currentFeature: AiFeature = AiFeature.NONE;
  private isConnected = false;
  
  // State for text accumulation
  private currentResponseText = "";
  private responseFinished = true;

  constructor() {
    // Only initialize if API key is available
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'PLACEHOLDER_API_KEY') {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  async connect(
    feature: AiFeature, 
    scriptContext: string, // For teleprompter context or interviewer context
    callbacks: LiveSessionCallbacks
  ) {
    this.disconnect();
    this.currentFeature = feature;
    this.currentResponseText = "";
    this.responseFinished = true;
    this.isConnected = false;

    let systemInstruction = "";
    if (feature === AiFeature.INTERVIEWER) {
      systemInstruction = `
        You are a professional video podcast interviewer.
        Your goal is to help the user create engaging content.
        Listen to what they are saying. 
        If they pause for more than 2 seconds, or if they seem stuck, suggest a short, relevant follow-up question or topic to discuss.
        Keep your output very brief and encouraging.
        Output ONLY the question text. Do not output anything else.
      `;
    } else if (feature === AiFeature.TELEPROMPTER) {
      systemInstruction = `
        You are a high-performance, real-time speech recognition engine.
        Your ONLY task is to output the exact verbatim transcription of the user's speech as fast as possible.
        Do not answer questions. Do not summarize. Do not wait for sentences to finish. 
        Stream words immediately as they are recognized.
        Support both Chinese and English transcription.
      `;
    }

    const config: any = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
      },
      inputAudioTranscription: {}, 
      systemInstruction: systemInstruction,
    };

    if (feature === AiFeature.INTERVIEWER) {
       config.outputAudioTranscription = {};
    }

    this.sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      config,
      callbacks: {
        onopen: async () => {
          this.isConnected = true;
          callbacks.onOpen();
          await this.startAudioStream();
        },
        onmessage: (message: LiveServerMessage) => {
          // Handle Input Transcription (User Speech) - Critical for Teleprompter
          if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            if (text) {
               callbacks.onTranscriptUpdate(text);
            }
          }

          // Handle Model Response (Interviewer Question)
          if (feature === AiFeature.INTERVIEWER) {
             if (message.serverContent?.outputTranscription) {
                const text = message.serverContent.outputTranscription.text;
                if (text) {
                   if (this.responseFinished) {
                       this.currentResponseText = "";
                       this.responseFinished = false;
                   }
                   this.currentResponseText += text;
                   callbacks.onInterviewerQuestion(this.currentResponseText);
                }
             }
             
             if (message.serverContent?.turnComplete) {
                this.responseFinished = true;
             }
             if (message.serverContent?.interrupted) {
                this.responseFinished = true;
             }
          }
        },
        onclose: () => {
          console.log('Session closed');
          this.isConnected = false;
        },
        onerror: (e: any) => {
          console.error("Session Error:", e);
          this.isConnected = false;
          const msg = e.message || "Network error or session closed";
          callbacks.onError(new Error(msg));
        }
      }
    });
  }

  private async startAudioStream() {
    if (!navigator.mediaDevices) return;
    if (!this.isConnected) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // OPTIMIZATION: 'interactive' latencyHint
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: PCM_SAMPLE_RATE,
        latencyHint: 'interactive' 
      });

      this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
      
      // OPTIMIZATION: Reduced buffer size to 1024 for ~64ms latency updates (vs 4096's ~256ms)
      this.processor = this.audioContext.createScriptProcessor(1024, 1, 1);

      this.processor.onaudioprocess = (e) => {
        // Critical check: Ensure we don't try to send if session is gone/closed
        if (!this.isConnected) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createPcmBlob(inputData);
        
        if (this.sessionPromise) {
          this.sessionPromise.then((session) => {
             // Double check inside promise to avoid race condition on close
             if (this.isConnected) {
               session.sendRealtimeInput({ media: pcmBlob });
             }
          }).catch(err => {
              // Silent fail is better than crashing loop, but log periodically if needed
              // console.warn("Frame drop", err);
          });
        }
      };

      this.mediaStreamSource.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (e) {
      console.error("Audio stream failed", e);
    }
  }

  disconnect() {
    this.isConnected = false;
    
    // Clean up Audio Pipeline first
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
    }
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      try {
        this.mediaStreamSource.mediaStream.getTracks().forEach(t => t.stop());
      } catch (e) {}
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    // Then close session
    if (this.sessionPromise) {
      this.sessionPromise.then(s => s.close()).catch(e => console.log("Close ignored", e));
      this.sessionPromise = null;
    }
    
    this.mediaStreamSource = null;
    this.processor = null;
    this.audioContext = null;
  }
}

export const geminiLive = new GeminiLiveService();