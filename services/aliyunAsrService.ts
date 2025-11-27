import { AiFeature } from '../types';

interface AsrCallbacks {
  onTranscriptUpdate: (text: string) => void;
  onInterviewerQuestion?: (text: string) => void;
  onOpen: () => void;
  onError: (e: Error) => void;
}

interface AliyunAsrConfig {
  appKey: string;
  token: string;
  format: string;
  sampleRate: number;
  enableIntermediateResult: boolean;
  enablePunctuationPrediction: boolean;
  enableInverseTextNormalization: boolean;
}

export class AliyunAsrService {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private currentFeature: AiFeature = AiFeature.NONE;
  private isConnected = false;
  private callbacks: AsrCallbacks | null = null;

  // Token and config
  private appKey: string = '';
  private token: string = '';

  // Interview mode state
  private lastSpeechTime: number = 0;
  private silenceTimer: NodeJS.Timeout | null = null;
  private currentTranscript: string = '';

  constructor() {}

  async connect(
    feature: AiFeature,
    scriptContext: string,
    callbacks: AsrCallbacks
  ) {
    this.disconnect();
    this.currentFeature = feature;
    this.callbacks = callbacks;
    this.isConnected = false;
    this.currentTranscript = '';

    // Detect language from script context
    const detectedLanguage = this.detectLanguage(scriptContext);
    console.log('Detected language for ASR:', detectedLanguage);

    // Get token first
    try {
      await this.getToken();
    } catch (e: any) {
      callbacks.onError(new Error(`Failed to get Aliyun token: ${e.message}`));
      return;
    }

    // Start audio stream first to prepare audio
    try {
      await this.startAudioStream();
    } catch (e: any) {
      callbacks.onError(new Error(`Failed to start audio: ${e.message}`));
      return;
    }

    // Then connect WebSocket with detected language
    try {
      await this.connectWebSocket(detectedLanguage);
      callbacks.onOpen();
    } catch (e: any) {
      callbacks.onError(new Error(`Failed to connect ASR: ${e.message}`));
    }
  }

  private detectLanguage(text: string): string {
    if (!text || text.length === 0) {
      return 'mandarin'; // Default to Chinese
    }

    // Count Chinese characters
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
    const chineseCount = chineseChars ? chineseChars.length : 0;

    // Count English letters
    const englishChars = text.match(/[a-zA-Z]/g);
    const englishCount = englishChars ? englishChars.length : 0;

    // If more than 30% is English, use English recognition
    const totalChars = text.length;
    const englishRatio = englishCount / totalChars;

    if (englishRatio > 0.3) {
      console.log(`English ratio: ${(englishRatio * 100).toFixed(1)}%, using English ASR`);
      return 'english';
    } else {
      console.log(`Chinese ratio: ${((chineseCount / totalChars) * 100).toFixed(1)}%, using Chinese ASR`);
      return 'mandarin';
    }
  }

  private async getToken(): Promise<void> {
    // For now, we'll use the token directly from env
    // In production, you should get token from your backend server to avoid exposing credentials
    const token = process.env.ALIYUN_TOKEN;

    if (token) {
      // Use pre-generated token
      this.token = token;
      this.appKey = process.env.ALIYUN_APP_KEY || '';
      if (!this.appKey) {
        throw new Error('Missing ALIYUN_APP_KEY in environment variables');
      }
      console.log('Using provided Aliyun token');
      return;
    }

    // If no token provided, we need to generate one
    // NOTE: Direct API call from browser will fail due to CORS
    // You should implement a backend endpoint to generate tokens
    throw new Error(
      'ALIYUN_TOKEN not found in environment. ' +
      'Please generate a token using your backend server or set ALIYUN_TOKEN in .env.local. ' +
      'To generate token, visit: https://help.aliyun.com/zh/isi/getting-started/obtain-an-access-token'
    );
  }

  private async connectWebSocket(language: string = 'mandarin'): Promise<void> {
    return new Promise((resolve, reject) => {
      const config: AliyunAsrConfig = {
        appKey: this.appKey,
        token: this.token,
        format: 'pcm',
        sampleRate: 16000,
        enableIntermediateResult: true, // Enable real-time partial results
        enablePunctuationPrediction: true,
        enableInverseTextNormalization: true,
      };

      const wsUrl = `wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1`;
      const params = new URLSearchParams({
        token: this.token,
      });

      this.ws = new WebSocket(`${wsUrl}?${params.toString()}`);

      this.ws.onopen = () => {
        console.log('Aliyun ASR WebSocket connected');

        // Send start command according to Aliyun protocol
        const taskId = this.generateTaskId();
        const startCmd = {
          header: {
            message_id: this.generateMessageId(),
            task_id: taskId,
            namespace: 'SpeechTranscriber',
            name: 'StartTranscription',
            appkey: config.appKey,
          },
          payload: {
            format: 'pcm',
            sample_rate: 16000,
            enable_intermediate_result: true,
            enable_punctuation_prediction: true,
            enable_inverse_text_normalization: true,
            language_hints: [language], // Set language based on script content
          }
        };

        console.log('Sending StartTranscription command with language:', language);
        console.log('Command:', JSON.stringify(startCmd, null, 2));
        console.log('Using AppKey:', config.appKey);
        console.log('Using Token:', this.token.substring(0, 10) + '...');
        this.ws?.send(JSON.stringify(startCmd));
        this.isConnected = true;
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleAsrMessage(message);
        } catch (e) {
          console.error('Failed to parse ASR message:', e);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnected = false;
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        this.isConnected = false;

        // Only notify on truly unexpected errors (not manual disconnect or token issues)
        // 1000 = Normal closure
        // 4402 = Token expired or invalid (expected, don't show error to user)
        if (event.code !== 1000 && event.code !== 4402 && this.callbacks) {
          this.callbacks.onError(new Error(`WebSocket closed unexpectedly: ${event.code} ${event.reason}`));
        }
      };
    });
  }

  private handleAsrMessage(message: any) {
    console.log('Received ASR message (full):', JSON.stringify(message, null, 2));

    const { header, payload } = message;

    if (!header) {
      console.warn('No header in message');
      return;
    }

    console.log('Message type:', header.name);
    console.log('Header status:', header.status);
    console.log('Header status_text:', header.status_text);

    // Handle start transcription response
    if (header.name === 'TranscriptionStarted') {
      console.log('Transcription started successfully');
      return;
    }

    // Handle transcription results
    if (header.name === 'TranscriptionResultChanged' || header.name === 'SentenceEnd') {
      const text = payload?.result;
      console.log('Transcription result:', text);

      if (text && this.callbacks) {
        // Update transcript
        this.callbacks.onTranscriptUpdate(text);
        this.currentTranscript += ' ' + text;
        this.lastSpeechTime = Date.now();

        // For interviewer mode, detect silence and generate questions
        if (this.currentFeature === AiFeature.INTERVIEWER) {
          this.handleInterviewMode();
        }
      }
    }

    // Handle errors - check both header and payload
    if (header.name === 'TaskFailed') {
      const errorMessage = header.status_text || payload?.message || payload?.error_message || 'ASR task failed';
      const errorCode = header.status || payload?.code || payload?.error_code || 'Unknown';
      console.error('ASR Task Failed:', {
        message: errorMessage,
        code: errorCode,
        header: header,
        payload: payload,
        fullMessage: message
      });
      this.callbacks?.onError(new Error(`${errorMessage} (Code: ${errorCode})`));
    }
  }

  private async handleInterviewMode() {
    // Clear existing timer
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }

    // Set new timer for silence detection (2 seconds)
    this.silenceTimer = setTimeout(async () => {
      // Generate a follow-up question using AI
      if (this.callbacks?.onInterviewerQuestion && this.currentTranscript.length > 10) {
        try {
          const question = await this.generateAIQuestion(this.currentTranscript);
          this.callbacks.onInterviewerQuestion(question);
        } catch (e) {
          console.error('Failed to generate AI question:', e);
          // Fallback to simple questions
          const questions = [
            "能详细说说这个吗？",
            "这很有趣！接下来发生了什么？",
            "这让你有什么感受？",
            "Can you tell me more about that?",
            "That's interesting! What happened next?",
          ];
          const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
          this.callbacks.onInterviewerQuestion(randomQuestion);
        }
      }
    }, 2000);
  }

  private async generateAIQuestion(transcript: string): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.href,
        'X-Title': 'TuiliRec Interviewer',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-preview', // Using Gemini 3 Pro Preview (latest flagship model)
        messages: [
          {
            role: 'user',
            content: `You are a professional interviewer. Based on what the person just said, generate ONE short, engaging follow-up question to keep the conversation flowing. The question should be natural, encouraging, and help them elaborate on their thoughts. Keep it under 20 words. Respond in the same language as the input.\n\nThe person just said: "${transcript}"\n\nGenerate a short follow-up question:`
          }
        ],
        temperature: 0.7,
        max_tokens: 50,
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API failed: ${response.statusText}`);
    }

    const data = await response.json();
    const question = data.choices[0]?.message?.content?.trim();

    if (!question) {
      throw new Error('No question generated');
    }

    return question;
  }

  private async startAudioStream() {
    if (!navigator.mediaDevices) {
      throw new Error('MediaDevices not available');
    }

    try {
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted');

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
        latencyHint: 'interactive'
      });

      this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
      this.processor = this.audioContext.createScriptProcessor(1024, 1, 1);

      this.processor.onaudioprocess = (e) => {
        // Check both WebSocket state AND isConnected flag
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = this.floatTo16BitPCM(inputData);

        // Send binary audio data
        try {
          this.ws.send(pcmData);
        } catch (err) {
          // Silent fail - connection may be closing
        }
      };

      this.mediaStreamSource.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      console.log('Audio stream started successfully');
    } catch (e) {
      console.error('Failed to start audio stream:', e);
      throw e;
    }
  }

  private floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  }

  private generateMessageId(): string {
    // Aliyun requires 32 hex characters
    return this.generate32HexId();
  }

  private generateTaskId(): string {
    // Aliyun requires 32 hex characters
    return this.generate32HexId();
  }

  private generate32HexId(): string {
    // Generate 32 random hexadecimal characters
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += Math.floor(Math.random() * 16).toString(16);
    }
    return result;
  }

  disconnect() {
    // Set flag first to stop audio processing immediately
    this.isConnected = false;

    // Clear silence timer
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    // Clean up audio pipeline FIRST (before closing WebSocket)
    if (this.processor) {
      this.processor.onaudioprocess = null; // Stop processing immediately
      this.processor.disconnect();
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

    // Then close WebSocket gracefully
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        try {
          // Send stop command
          const stopCmd = {
            header: {
              message_id: this.generateMessageId(),
              task_id: this.generateTaskId(),
              namespace: 'SpeechTranscriber',
              name: 'StopTranscription',
              appkey: this.appKey,
            }
          };
          this.ws.send(JSON.stringify(stopCmd));
        } catch (e) {
          // Ignore send errors during disconnect
        }
      }
      this.ws.close();
      this.ws = null;
    }

    this.mediaStreamSource = null;
    this.processor = null;
    this.audioContext = null;
    this.currentTranscript = '';
  }
}

export const aliyunAsr = new AliyunAsrService();
