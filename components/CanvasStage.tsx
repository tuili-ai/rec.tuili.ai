import React, { useRef, useEffect } from 'react';
import { CanvasState, BG_COLORS } from '../types';

interface CanvasStageProps {
  state: CanvasState;
  screenStream: MediaStream | null;
  cameraStream: MediaStream | null;
  audioLevel: number;
  onUpdateCamPos: (x: number, y: number) => void;
  onUpdateZoomPan: (zoom: number, panX: number, panY: number) => void;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  state,
  screenStream,
  cameraStream,
  audioLevel,
  onUpdateCamPos,
  onUpdateZoomPan
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoScreenRef = useRef<HTMLVideoElement>(document.createElement('video'));
  const videoCamRef = useRef<HTMLVideoElement>(document.createElement('video'));
  const animationFrameRef = useRef<number>(0);
  
  // Internal state for smooth animations
  const smoothState = useRef({
    zoom: 1,
    panX: 0,
    panY: 0
  });

  // Attach streams to hidden video elements
  useEffect(() => {
    const vScreen = videoScreenRef.current;
    if (screenStream && vScreen.srcObject !== screenStream) {
      vScreen.srcObject = screenStream;
      vScreen.play().catch(e => console.error("Screen play error", e));
      vScreen.muted = true;
    }
  }, [screenStream]);

  useEffect(() => {
    const vCam = videoCamRef.current;
    if (cameraStream && vCam.srcObject !== cameraStream) {
      vCam.srcObject = cameraStream;
      vCam.play().catch(e => console.error("Cam play error", e));
      vCam.muted = true;
    }
  }, [cameraStream]);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // 1. Smooth Interpolation
      smoothState.current.zoom += (state.zoom - smoothState.current.zoom) * 0.08;
      smoothState.current.panX += (state.panX - smoothState.current.panX) * 0.08;
      smoothState.current.panY += (state.panY - smoothState.current.panY) * 0.08;

      const W = state.width;
      const H = state.height;
      const zoom = smoothState.current.zoom;
      const panX = smoothState.current.panX;
      const panY = smoothState.current.panY;

      // Clear Canvas
      ctx.clearRect(0,0,W,H);

      // Transform for Zoom/Pan (Applied Globally)
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-W / 2 - panX, -H / 2 - panY);

      if (state.isFullCam) {
          // --- FULL CAMERA MODE ---
          // Draw Background (Fallback)
          const grad = ctx.createLinearGradient(0, 0, W, H);
          const colors = BG_COLORS[state.bgIndex];
          grad.addColorStop(0, colors[0]);
          grad.addColorStop(1, colors[1]);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H);

          const vCam = videoCamRef.current;
          if (vCam.readyState >= 2) {
              const vw = vCam.videoWidth;
              const vh = vCam.videoHeight;
              
              // Object Fit: Cover
              // Scale to fill the larger dimension relative to canvas
              const scale = Math.max(W / vw, H / vh);
              const dw = vw * scale;
              const dh = vh * scale;
              const offsetX = (W - dw) / 2;
              const offsetY = (H - dh) / 2;
              
              ctx.drawImage(vCam, offsetX, offsetY, dw, dh);
          } else {
              // Placeholder if cam is loading in full mode
               ctx.fillStyle = "#111";
               ctx.fillRect(0, 0, W, H);
          }

      } else {
          // --- STANDARD SCREEN SHARE MODE ---
          
          // 2. Draw Background
          const grad = ctx.createLinearGradient(0, 0, W, H);
          const colors = BG_COLORS[state.bgIndex];
          grad.addColorStop(0, colors[0]);
          grad.addColorStop(1, colors[1]);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H);

          // 3. Draw Screen Share
          const vScreen = videoScreenRef.current;
          if (vScreen.readyState >= 2) {
            const padding = state.usePadding ? H * 0.08 : 0;
            const screenW = W - padding * 2;
            const screenH = H - padding * 2;

            ctx.save();
            if (state.usePadding) {
              ctx.shadowColor = "rgba(0,0,0,0.4)";
              ctx.shadowBlur = 50;
              ctx.shadowOffsetY = 20;
            }

            // Rounded Rect Clip
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(padding, padding, screenW, screenH, state.usePadding ? 30 : 0);
            } else {
                ctx.rect(padding, padding, screenW, screenH);
            }
            ctx.fillStyle = "#000"; // Fallback fill
            ctx.fill();
            ctx.shadowColor = "transparent";
            ctx.clip();

            // Object Fit: Portrait uses Cover, Landscape uses Contain
            const vw = vScreen.videoWidth;
            const vh = vScreen.videoHeight;
            const isCanvasPortrait = state.aspectRatio < 1;
            // Portrait (9:16, 3:4): Fill entire area (may crop)
            // Landscape (16:9, 4:3): Show full content (may have letterbox)
            const scale = isCanvasPortrait
                ? Math.max(screenW / vw, screenH / vh)  // Cover
                : Math.min(screenW / vw, screenH / vh); // Contain
            const dw = vw * scale;
            const dh = vh * scale;

            ctx.drawImage(vScreen, padding + (screenW - dw) / 2, padding + (screenH - dh) / 2, dw, dh);
            ctx.restore();
          }

          // 4. Draw PIP Camera Overlay
          const vCam = videoCamRef.current;
          if (state.camEnabled && vCam.readyState >= 2) {
            const { camX, camY, camSize } = state;
            const r = camSize / 2;
            const cx = camX + r;
            const cy = camY + r;

            ctx.save();
            
            // Audio Reactive Ring
            const vol = Math.min(audioLevel / 40, 1); 
            if (vol > 0.1) {
              ctx.beginPath();
              ctx.arc(cx, cy, r + vol * 15, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(0, 113, 227, ${0.3 + vol * 0.2})`;
              ctx.fill();
            }

            // Circular Clip
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.shadowColor = "rgba(0,0,0,0.3)";
            ctx.shadowBlur = 20;
            ctx.shadowOffsetY = 5;
            ctx.clip();

            // Draw Cam
            const minDim = Math.min(vCam.videoWidth, vCam.videoHeight);
            ctx.drawImage(
                vCam, 
                (vCam.videoWidth - minDim) / 2, 
                (vCam.videoHeight - minDim) / 2, 
                minDim, minDim, 
                camX, camY, camSize, camSize
            );

            // Border
            ctx.shadowColor = "transparent";
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = camSize * 0.03;
            ctx.stroke();

            ctx.restore();
          }
      }

      ctx.restore(); // Restore Zoom/Pan Transform

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [state, audioLevel, state.width, state.height, state.bgIndex, state.usePadding, state.camEnabled, state.camX, state.camY, state.zoom, state.panX, state.panY, state.isFullCam]);

  // Handle Dragging Logic for Camera & Canvas Pan
  const dragTargetRef = useRef<'camera' | 'canvas' | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = state.width / rect.width;
    const scaleY = state.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // 1. Check Camera Click (Only in PIP mode)
    if (!state.isFullCam && state.camEnabled) {
        const cx = state.camX + state.camSize / 2;
        const cy = state.camY + state.camSize / 2;
        
        if (Math.hypot(mx - cx, my - cy) < state.camSize / 2) {
          dragTargetRef.current = 'camera';
          return;
        }
    }

    // 2. Check Canvas Pan (if Zoomed in)
    if (state.zoom > 1) {
      dragTargetRef.current = 'canvas';
      return;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragTargetRef.current) return;
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = state.width / rect.width;
    const scaleY = state.height / rect.height;

    if (dragTargetRef.current === 'camera') {
        const newX = state.camX + e.movementX * scaleX;
        const newY = state.camY + e.movementY * scaleY;
        onUpdateCamPos(newX, newY);
    } 
    else if (dragTargetRef.current === 'canvas') {
        const deltaX = e.movementX * scaleX / state.zoom;
        const deltaY = e.movementY * scaleY / state.zoom;
        
        onUpdateZoomPan(state.zoom, state.panX - deltaX, state.panY - deltaY);
    }
  };

  const handleMouseUp = () => {
    dragTargetRef.current = null;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
     if (state.zoom === 1) {
         // Zoom In to 2.2x
         const rect = canvasRef.current!.getBoundingClientRect();
         const clickXRatio = (e.clientX - rect.left) / rect.width;
         const clickYRatio = (e.clientY - rect.top) / rect.height;
         
         const clickX = clickXRatio * state.width;
         const clickY = clickYRatio * state.height;
         
         const targetPanX = clickX - state.width / 2;
         const targetPanY = clickY - state.height / 2;
         
         onUpdateZoomPan(2.2, targetPanX, targetPanY);
     } else {
         // Reset
         onUpdateZoomPan(1, 0, 0);
     }
  };

  const isPortrait = state.aspectRatio < 1;

  // Cursor style
  const getCursor = () => {
      if (state.zoom > 1) return 'cursor-grab active:cursor-grabbing';
      if (!state.isFullCam && state.camEnabled) return 'cursor-auto'; // Default or special for hover?
      return 'cursor-default';
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-10 pb-32 transition-all duration-700">
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 border border-black/5"
        style={{
            maxWidth: '92vw',
            maxHeight: '70vh'
        }}
      >
        <canvas
            ref={canvasRef}
            width={state.width}
            height={state.height}
            className={`w-full h-full block ${getCursor()}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
        />
      </div>

      {/* Double Click Tip - Centered at bottom */}
      <div className="mt-6 bg-white/50 backdrop-blur-md px-4 py-2 rounded-full text-xs font-medium text-gray-500 shadow-sm pointer-events-none select-none border border-white/20">
         Double click to Zoom • Drag camera to move
      </div>
    </div>
  );
};