import { AiFeature } from '../types';

interface SpeechCallbacks {
  onTranscriptUpdate: (text: string) => void;
  onInterviewerQuestion?: (text: string) => void;
  onOpen: () => void;
  onError: (e: Error) => void;
}

// Use browser's native Web Speech API (works in Chrome/Edge)
export class WebSpeechService {
  private recognition: any = null;
  private currentFeature: AiFeature = AiFeature.NONE;
  private callbacks: SpeechCallbacks | null = null;
  private isActive = false;

  // Interview mode state
  private lastSpeechTime: number = 0;
  private silenceTimer: NodeJS.Timeout | null = null;
  private currentTranscript: string = '';

  constructor() {
    // Check browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported in this browser');
    }
  }

  async connect(
    feature: AiFeature,
    scriptContext: string,
    callbacks: SpeechCallbacks
  ) {
    this.disconnect();
    this.currentFeature = feature;
    this.callbacks = callbacks;
    this.currentTranscript = '';

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      callbacks.onError(new Error('Web Speech API not supported. Please use Chrome or Edge browser.'));
      return;
    }

    this.recognition = new SpeechRecognition();

    // Configure recognition
    this.recognition.continuous = true; // Keep listening
    this.recognition.interimResults = true; // Get partial results
    this.recognition.lang = 'zh-CN'; // Chinese language (change to 'en-US' for English)
    this.recognition.maxAlternatives = 1;

    // Handle results
    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Send updates
      const text = finalTranscript || interimTranscript;
      if (text && this.callbacks) {
        this.callbacks.onTranscriptUpdate(text);

        if (finalTranscript) {
          this.currentTranscript += ' ' + finalTranscript;
          this.lastSpeechTime = Date.now();

          // For interviewer mode, detect silence
          if (this.currentFeature === AiFeature.INTERVIEWER) {
            this.handleInterviewMode();
          }
        }
      }
    };

    // Handle errors
    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);

      // Don't treat "no-speech" as a fatal error
      if (event.error !== 'no-speech') {
        this.callbacks?.onError(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    // Handle end
    this.recognition.onend = () => {
      // Restart if still active
      if (this.isActive) {
        console.log('Restarting speech recognition...');
        try {
          this.recognition.start();
        } catch (e) {
          console.error('Failed to restart recognition:', e);
        }
      }
    };

    // Start recognition
    try {
      this.recognition.start();
      this.isActive = true;
      callbacks.onOpen();
      console.log('Web Speech Recognition started');
    } catch (e: any) {
      callbacks.onError(new Error(`Failed to start speech recognition: ${e.message}`));
    }
  }

  private handleInterviewMode() {
    // Clear existing timer
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }

    // Set new timer for silence detection (2 seconds)
    this.silenceTimer = setTimeout(() => {
      // Generate a follow-up question based on the current transcript
      if (this.callbacks?.onInterviewerQuestion && this.currentTranscript.length > 10) {
        const questions = [
          "能详细说说这个吗？",
          "这很有趣！接下来发生了什么？",
          "这让你有什么感受？",
          "你从中学到了什么？",
          "能再展开讲讲这一点吗？",
          "Can you tell me more about that?",
          "That's interesting! What happened next?",
          "How did that make you feel?",
        ];
        const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
        this.callbacks.onInterviewerQuestion(randomQuestion);
      }
    }, 2000);
  }

  disconnect() {
    this.isActive = false;

    // Clear silence timer
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    // Stop recognition
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.log('Recognition already stopped');
      }
      this.recognition = null;
    }

    this.currentTranscript = '';
    console.log('Web Speech Recognition stopped');
  }
}

export const webSpeech = new WebSpeechService();
