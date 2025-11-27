import React, { useState, useEffect, useRef } from 'react';
import { Welcome } from './components/Welcome';
import { CanvasStage } from './components/CanvasStage';
import { ControlDock } from './components/ControlDock';
import { TopPanel } from './components/TopPanel';
import { SettingsDialog } from './components/SettingsDialog';
import { AppMode, AiFeature, CanvasState, BG_COLORS } from './types';
import { geminiLive } from './services/geminiService';
import { aliyunAsr } from './services/aliyunAsrService';
import { webSpeech } from './services/webSpeechService';

const DEFAULT_SCRIPT = "Welcome to TuiliRec. This is a demo script for the teleprompter feature. As you speak, these words will light up in real-time, guiding your recording flow perfectly. Try speaking this text now to see the magic happen.";

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.IDLE);
  const [aiFeature, setAiFeature] = useState<AiFeature>(AiFeature.NONE);
  const [showSettings, setShowSettings] = useState(false);
  
  // Streams
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  
  // Audio Analysis
  const [audioLevel, setAudioLevel] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // Recorder
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Dedicated AudioContext for mixing recording audio streams
  const mixingAudioCtxRef = useRef<AudioContext | null>(null);

  // AI Content State
  const [interviewerQuestion, setInterviewerQuestion] = useState("");
  const [teleprompterScript, setTeleprompterScript] = useState(DEFAULT_SCRIPT);
  const [transcript, setTranscript] = useState("");

  // Canvas State
  const [canvasState, setCanvasState] = useState<CanvasState>({
    width: 2560,
    height: 1440,
    bgIndex: 0,
    usePadding: true,
    aspectRatio: 1.777,
    camEnabled: true,
    camX: 2000,
    camY: 1000,
    camSize: 350,
    isFullCam: false,
    zoom: 1,
    panX: 0,
    panY: 0
  });

  // Handle Resize updates
  useEffect(() => {
    const base = 2560;
    let w = base;
    let h = base / canvasState.aspectRatio;
    if (canvasState.aspectRatio < 1) {
       h = base;
       w = base * canvasState.aspectRatio;
    }
    
    // Update cam position if it goes out of bounds roughly
    let cx = canvasState.camX;
    let cy = canvasState.camY;
    if (cx > w) cx = w - 400;
    if (cy > h) cy = h - 400;

    setCanvasState(prev => ({ ...prev, width: w, height: h, camX: cx, camY: cy }));
  }, [canvasState.aspectRatio]);


  // Initialization
  const handleInit = async () => {
    try {
      const sStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: 60 }, 
        audio: true 
      });
      const cStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, 
        audio: true 
      });

      setScreenStream(sStream);
      setCameraStream(cStream);

      // Setup local audio analysis for the ring effect
      const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = actx.createMediaStreamSource(cStream);
      const analyser = actx.createAnalyser();
      analyser.fftSize = 32;
      source.connect(analyser);
      
      audioCtxRef.current = actx;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      setMode(AppMode.PREVIEW);
      startAudioLoop();
    } catch (e) {
      console.error("Init failed", e);
      alert("Failed to initialize. Please allow permissions.");
    }
  };

  const startAudioLoop = () => {
    const loop = () => {
      if (analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        const sum = dataArrayRef.current.reduce((a, b) => a + b, 0);
        setAudioLevel(sum / dataArrayRef.current.length);
      }
      requestAnimationFrame(loop);
    };
    loop();
  };

  // AI Feature Toggle Logic
  const handleSetAiFeature = async (feature: AiFeature) => {
    setAiFeature(feature);

    // Reset states
    setInterviewerQuestion("");
    setTranscript("");

    if (feature === AiFeature.NONE) {
      // Disconnect all services
      geminiLive.disconnect();
      aliyunAsr.disconnect();
      webSpeech.disconnect();
    } else if (feature === AiFeature.TELEPROMPTER) {
      // For Teleprompter: Use Aliyun ASR only (faster, more accurate)
      const callbacks = {
        onOpen: () => console.log("Aliyun ASR Connected (Teleprompter)"),
        onError: (e: Error) => {
            console.error(e);
            setAiFeature(AiFeature.NONE);
            alert(`Aliyun ASR Failed: ${e.message}`);
        },
        onInterviewerQuestion: (q: string) => setInterviewerQuestion(q),
        onTranscriptUpdate: (t: string) => {
            setTranscript(prev => prev + " " + t);
        }
      };

      try {
        await aliyunAsr.connect(feature, teleprompterScript, callbacks);
      } catch (e: any) {
        console.error("Aliyun ASR Error", e);
        setAiFeature(AiFeature.NONE);
        alert(`Failed to start Aliyun ASR: ${e.message}`);
      }
    } else if (feature === AiFeature.INTERVIEWER) {
      // For Interviewer: Use Gemini Live (real-time AI conversation)
      try {
        await geminiLive.connect(
          feature,
          "",
          {
            onOpen: () => console.log("Gemini Live Connected (Interviewer)"),
            onError: (e) => {
                console.error(e);
                setAiFeature(AiFeature.NONE);
                alert(`Gemini Live Failed: ${e.message}`);
            },
            onInterviewerQuestion: (q) => setInterviewerQuestion(q),
            onTranscriptUpdate: (t) => {
                setTranscript(prev => prev + " " + t);
            }
          }
        );
      } catch (e: any) {
        console.error("Gemini Live Error", e);
        setAiFeature(AiFeature.NONE);
        alert(`Failed to start Gemini Live: ${e.message}`);
      }
    }
  };

  // Recording Logic
  const startRecording = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    // Use 30fps for better stability and A/V sync
    const stream = canvas.captureStream(30);

    // --- AUDIO MIXING LOGIC START ---
    // We need to mix system audio and mic audio into a single track,
    // otherwise MediaRecorder often only records the first track added.
    const mixCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 48000, // Standard sample rate for video recording
      latencyHint: 'playback' // Optimize for consistent timing over low latency
    });
    mixingAudioCtxRef.current = mixCtx;
    const dest = mixCtx.createMediaStreamDestination();
    let hasAudioSource = false;

    // Mix Screen Audio (System Sound)
    if (screenStream && screenStream.getAudioTracks().length > 0) {
      try {
        const sysTrack = screenStream.getAudioTracks()[0];
        if (sysTrack.readyState === 'live') {
           const sysSource = mixCtx.createMediaStreamSource(screenStream);
           sysSource.connect(dest);
           hasAudioSource = true;
        }
      } catch (e) {
        console.warn("Error adding screen audio to mix:", e);
      }
    }

    // Mix Microphone Audio
    if (cameraStream && cameraStream.getAudioTracks().length > 0) {
      try {
        const micTrack = cameraStream.getAudioTracks()[0];
        if (micTrack.readyState === 'live') {
           const micSource = mixCtx.createMediaStreamSource(cameraStream);
           micSource.connect(dest);
           hasAudioSource = true;
        }
      } catch (e) {
        console.warn("Error adding mic audio to mix:", e);
      }
    }

    // If we successfully added audio sources, add the mixed track to the recording stream
    if (hasAudioSource) {
      const mixedTrack = dest.stream.getAudioTracks()[0];
      if (mixedTrack) {
        stream.addTrack(mixedTrack);
      }
    }
    // --- AUDIO MIXING LOGIC END ---

    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    const rec = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 8000000, // Reduced from 12M for better stability
      audioBitsPerSecond: 128000
    });

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TuiliRec_${Date.now()}.${mimeType === 'video/mp4' ? 'mp4' : 'webm'}`;
      a.click();
      chunksRef.current = [];
      setMode(AppMode.PREVIEW);
    };

    // Use timeslice to write data periodically (improves sync and reduces memory)
    rec.start(1000); // Write data every 1 second
    mediaRecorderRef.current = rec;
    setMode(AppMode.RECORDING);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    // Clean up mixing context
    if (mixingAudioCtxRef.current) {
      mixingAudioCtxRef.current.close();
      mixingAudioCtxRef.current = null;
    }
  };

  // --- Interaction Handlers ---
  const toggleCam = () => setCanvasState(p => ({ ...p, camEnabled: !p.camEnabled }));
  const toggleFullCam = () => setCanvasState(p => ({ ...p, isFullCam: !p.isFullCam }));
  const toggleBg = () => setCanvasState(p => ({ ...p, bgIndex: (p.bgIndex + 1) % BG_COLORS.length }));
  const togglePadding = () => setCanvasState(p => ({ ...p, usePadding: !p.usePadding }));
  const changeRatio = (r: number) => setCanvasState(p => ({ ...p, aspectRatio: r }));
  const updateCamPos = (x: number, y: number) => setCanvasState(p => ({ ...p, camX: x, camY: y }));
  const updateZoomPan = (zoom: number, panX: number, panY: number) => setCanvasState(p => ({ ...p, zoom, panX, panY }));

  return (
    <div className="relative w-full h-screen bg-[#f5f7fa] overflow-hidden flex flex-col items-center justify-center">
      
      {mode === AppMode.IDLE && <Welcome />}

      {/* Top AI Layer */}
      <TopPanel 
        feature={aiFeature}
        interviewerText={interviewerQuestion}
        teleprompterScript={teleprompterScript}
        transcript={transcript}
      />

      {/* Main Canvas Area */}
      <CanvasStage 
        state={canvasState}
        screenStream={screenStream}
        cameraStream={cameraStream}
        audioLevel={audioLevel}
        onUpdateCamPos={updateCamPos}
        onUpdateZoomPan={updateZoomPan}
      />

      {/* Settings Modal */}
      <SettingsDialog 
        isOpen={showSettings}
        currentScript={teleprompterScript}
        onClose={() => setShowSettings(false)}
        onSave={(s) => setTeleprompterScript(s)}
      />

      {/* Bottom Dock */}
      <ControlDock 
        mode={mode}
        aiFeature={aiFeature}
        isFullCam={canvasState.isFullCam}
        onInit={handleInit}
        onToggleBg={toggleBg}
        onTogglePadding={togglePadding}
        onChangeRatio={changeRatio}
        onToggleCam={toggleCam}
        onToggleFullCam={toggleFullCam}
        onStartRecord={startRecording}
        onStopRecord={stopRecording}
        onSetAiFeature={handleSetAiFeature}
        onOpenSettings={() => setShowSettings(true)}
      />
    </div>
  );
};

export default App;