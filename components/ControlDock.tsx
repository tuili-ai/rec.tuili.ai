import React from 'react';
import { AppMode, AiFeature } from '../types';
import { 
  Palette, Square, Monitor, UserCircle, 
  Circle, Square as StopSquare, Bot, Settings, Video
} from 'lucide-react';

interface ControlDockProps {
  mode: AppMode;
  aiFeature: AiFeature;
  isFullCam: boolean;
  onInit: () => void;
  onToggleBg: () => void;
  onTogglePadding: () => void;
  onChangeRatio: (r: number) => void;
  onToggleCam: () => void;
  onToggleFullCam: () => void;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onSetAiFeature: (f: AiFeature) => void;
  onOpenSettings: () => void;
}

export const ControlDock: React.FC<ControlDockProps> = ({
  mode,
  aiFeature,
  isFullCam,
  onInit,
  onToggleBg,
  onTogglePadding,
  onChangeRatio,
  onToggleCam,
  onToggleFullCam,
  onStartRecord,
  onStopRecord,
  onSetAiFeature,
  onOpenSettings
}) => {
  const isReady = mode !== AppMode.IDLE;
  const isRecording = mode === AppMode.RECORDING;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-500">
      <div className={`
        flex items-center gap-2 px-4 py-2.5 rounded-full 
        bg-white/80 backdrop-blur-2xl border border-white/20 shadow-xl
        transition-all duration-300
        ${isRecording ? 'border-red-500/30 shadow-red-500/20' : ''}
      `}>
        
        {!isReady ? (
          <button 
            onClick={onInit}
            className="flex items-center gap-2 bg-[#0071e3] hover:bg-[#0077ED] text-white px-5 py-2.5 rounded-full font-semibold shadow-lg shadow-blue-500/30 transition-all hover:scale-105 active:scale-95"
          >
            <span>⚡️</span> Initialize
          </button>
        ) : (
          <>
            {/* Visual Controls */}
            <div className="flex items-center gap-1 pr-3 border-r border-gray-300/50">
                <button onClick={onToggleBg} className="p-2.5 rounded-xl hover:bg-black/5 text-gray-700 transition-colors" title="Change Wallpaper">
                    <Palette size={18} />
                </button>
                <button onClick={onTogglePadding} className="p-2.5 rounded-xl hover:bg-black/5 text-gray-700 transition-colors" title="Toggle Padding">
                    <Square size={18} />
                </button>
                
                {/* Ratio Selector - Fixed Hover Gap Bug */}
                <div className="relative group">
                    <button className="p-2.5 rounded-xl hover:bg-black/5 text-gray-700 transition-colors flex items-center gap-1">
                        <Monitor size={18} />
                    </button>
                    {/* Wrapper with padding to bridge the gap between button and menu */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-3 hidden group-hover:block z-50">
                        <div className="flex flex-col bg-white/90 backdrop-blur-md rounded-xl shadow-xl border border-white/20 p-1 min-w-[120px]">
                            <button onClick={() => onChangeRatio(1.777)} className="px-3 py-2 text-xs font-medium hover:bg-blue-50 text-left rounded-lg whitespace-nowrap">16:9 Wide</button>
                            <button onClick={() => onChangeRatio(1.3333)} className="px-3 py-2 text-xs font-medium hover:bg-blue-50 text-left rounded-lg whitespace-nowrap">4:3 Standard</button>
                            <button onClick={() => onChangeRatio(0.5625)} className="px-3 py-2 text-xs font-medium hover:bg-blue-50 text-left rounded-lg whitespace-nowrap">9:16 Mobile</button>
                            <button onClick={() => onChangeRatio(0.75)} className="px-3 py-2 text-xs font-medium hover:bg-blue-50 text-left rounded-lg whitespace-nowrap">3:4 Social</button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-1 ml-1 pl-1 border-l border-gray-300/30">
                    <button 
                        onClick={onToggleCam} 
                        className={`p-2.5 rounded-xl transition-colors ${!isFullCam ? 'bg-black/10 text-black' : 'hover:bg-black/5 text-gray-500'}`} 
                        title="PIP Camera Mode"
                    >
                        <UserCircle size={18} />
                    </button>
                     <button 
                        onClick={onToggleFullCam} 
                        className={`p-2.5 rounded-xl transition-colors ${isFullCam ? 'bg-black/10 text-black' : 'hover:bg-black/5 text-gray-500'}`} 
                        title="Full Camera Mode"
                    >
                        <Video size={18} />
                    </button>
                </div>
            </div>

            {/* AI Controls */}
            <div className="flex items-center gap-1 px-3 border-r border-gray-300/50">
                <button 
                    onClick={() => onSetAiFeature(aiFeature === AiFeature.INTERVIEWER ? AiFeature.NONE : AiFeature.INTERVIEWER)}
                    disabled={isRecording}
                    className={`p-2.5 rounded-xl transition-all flex items-center gap-1.5 ${aiFeature === AiFeature.INTERVIEWER ? 'bg-blue-100 text-blue-600' : 'hover:bg-black/5 text-gray-700'} disabled:opacity-50`}
                    title="AI Interviewer"
                >
                    <Bot size={18} />
                </button>
                <button 
                    onClick={() => onSetAiFeature(aiFeature === AiFeature.TELEPROMPTER ? AiFeature.NONE : AiFeature.TELEPROMPTER)}
                    disabled={isRecording}
                    className={`p-2.5 rounded-xl transition-all flex items-center gap-1.5 ${aiFeature === AiFeature.TELEPROMPTER ? 'bg-green-100 text-green-600' : 'hover:bg-black/5 text-gray-700'} disabled:opacity-50`}
                    title="Teleprompter"
                >
                    <FileTextIcon size={18} />
                </button>
                {aiFeature === AiFeature.TELEPROMPTER && (
                    <button onClick={onOpenSettings} className="p-2.5 rounded-xl hover:bg-black/5 text-gray-500">
                        <Settings size={16} />
                    </button>
                )}
            </div>

            {/* Record Controls */}
            <div className="pl-1">
                {!isRecording ? (
                    <button 
                        onClick={onStartRecord}
                        className="flex items-center gap-2 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white px-4 py-2.5 rounded-xl font-semibold transition-all group"
                    >
                        <Circle size={18} className="fill-current" />
                        <span>Record</span>
                    </button>
                ) : (
                    <button 
                        onClick={onStopRecord}
                        className="flex items-center gap-2 bg-[#1d1d1f] text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg transition-all hover:scale-105"
                    >
                        <StopSquare size={18} className="fill-current" />
                        <span>Stop</span>
                    </button>
                )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Simple Icon wrapper needed here? Lucide exports as components.
const FileTextIcon = ({size, className}: {size?:number, className?:string}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
);