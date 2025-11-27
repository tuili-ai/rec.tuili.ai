import React, { useEffect, useRef, useState, useMemo } from 'react';
import { AiFeature } from '../types';
import { Mic, ChevronUp, ChevronDown } from 'lucide-react';

interface TopPanelProps {
  feature: AiFeature;
  interviewerText: string;
  teleprompterScript: string;
  transcript: string; // The accumulated transcript matching current session
}

// Utility to check for CJK characters
const isCJK = (str: string) => /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(str);

// Advanced Tokenizer for mixed Chinese/English
const parseSegmentToTokens = (segment: string): string[] => {
    const tokens: string[] = [];
    // Split by non-word boundaries but keep CJK chars as individual tokens
    // This regex looks for: English words OR individual CJK chars
    const regex = /[a-zA-Z0-9]+|[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g;
    let match;
    while ((match = regex.exec(segment)) !== null) {
        tokens.push(match[0]);
    }
    return tokens;
};

export const TopPanel: React.FC<TopPanelProps> = ({ 
  feature, 
  interviewerText, 
  teleprompterScript,
  transcript 
}) => {
  const [show, setShow] = useState(false);
  
  // -- Teleprompter State --
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [matchedWordCount, setMatchedWordCount] = useState(0);
  const lastTranscriptLengthRef = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Split script into sentence-like segments for cleaner display
  const segments = useMemo(() => {
    if (!teleprompterScript) return [];
    // Split by punctuation, but also respect newlines if user manually formatted
    return teleprompterScript
        .replace(/([.!?。！？])\s*/g, "$1|") // Add separator after punctuation
        .split('|')
        .map(s => s.trim())
        .filter(s => s.length > 0);
  }, [teleprompterScript]);

  // Pre-tokenize all segments for faster runtime matching
  const segmentTokensMap = useMemo(() => {
    return segments.map(seg => parseSegmentToTokens(seg));
  }, [segments]);

  useEffect(() => {
    setShow(feature !== AiFeature.NONE);
  }, [feature]);

  // Reset state when script changes or feature toggles
  useEffect(() => {
    setActiveSegmentIndex(0);
    setMatchedWordCount(0);
    lastTranscriptLengthRef.current = 0;
  }, [teleprompterScript, feature]);

  // -- High Performance Matching Logic --
  useEffect(() => {
    if (feature !== AiFeature.TELEPROMPTER) return;
    
    const fullTranscript = transcript; // Keep original casing for some things, but match lowercase
    const prevLen = lastTranscriptLengthRef.current;
    
    // Only process NEW text from the transcript
    if (fullTranscript.length <= prevLen) return;
    
    const newText = fullTranscript.slice(prevLen);
    lastTranscriptLengthRef.current = fullTranscript.length;
    
    // Tokenize spoken input similarly (words or CJK chars)
    const spokenTokens = parseSegmentToTokens(newText);
    if (spokenTokens.length === 0) return;
    
    const currentTokens = segmentTokensMap[activeSegmentIndex];
    if (!currentTokens) return; // End of script
    
    let currentMatchIndex = matchedWordCount;
    
    // 1. Match against Current Segment
    for (const token of spokenTokens) {
        const spokenClean = token.toLowerCase();
        
        // Greedy forward matching with lookahead window of 4 (Increased for speed)
        let matchFound = false;
        
        for (let offset = 0; offset <= 4; offset++) {
            const checkIndex = currentMatchIndex + offset;
            if (checkIndex >= currentTokens.length) break;
            
            const scriptToken = currentTokens[checkIndex].toLowerCase();
            
            if (spokenClean === scriptToken) {
                currentMatchIndex = checkIndex + 1; // Advance
                matchFound = true;
                break;
            }
        }

        // 2. Cross-Segment Lookahead (The "Jump" Feature)
        // CRITICAL UPDATE: Only look ahead if we are somewhat deep into the current line (e.g. > 60%).
        // This prevents early false jumps if the next line starts with a common word that appears early in current line.
        const completionRatio = currentTokens.length > 0 ? (currentMatchIndex / currentTokens.length) : 1;
        
        if (!matchFound && activeSegmentIndex < segments.length - 1 && completionRatio > 0.6) {
            const nextTokens = segmentTokensMap[activeSegmentIndex + 1];
            if (nextTokens && nextTokens.length > 0) {
                 // Check first 3 tokens of next segment (Reduced window from 5 to 3 for stricter matching)
                 for (let j = 0; j < Math.min(3, nextTokens.length); j++) {
                     if (spokenClean === nextTokens[j].toLowerCase()) {
                         // JUMP!
                         // Clear timeout if any
                         if (scrollTimeoutRef.current) {
                             clearTimeout(scrollTimeoutRef.current);
                             scrollTimeoutRef.current = null;
                         }
                         setActiveSegmentIndex(prev => prev + 1);
                         setMatchedWordCount(j + 1);
                         return; // Exit effect immediately to process next render
                     }
                 }
            }
        }
    }
    
    setMatchedWordCount(currentMatchIndex);
    
    // Auto Advance logic - STRICT SYNC
    // Only advance if we have matched ALL tokens in the current line.
    if (currentTokens.length > 0 && currentMatchIndex >= currentTokens.length) {
        if (!scrollTimeoutRef.current) {
            // Very short debounce just to ensure render update happens cleanly
            scrollTimeoutRef.current = setTimeout(() => {
                setActiveSegmentIndex(prev => Math.min(prev + 1, segments.length));
                setMatchedWordCount(0);
                scrollTimeoutRef.current = null;
            }, 50); 
        }
    }
    
  }, [transcript, activeSegmentIndex, matchedWordCount, segmentTokensMap, segments.length, feature]);

  // -- Manual Control Logic --
  const handleManualScroll = (direction: 'next' | 'prev') => {
    setActiveSegmentIndex(prev => {
        const nextIdx = direction === 'next' 
            ? Math.min(prev + 1, segments.length - 1)
            : Math.max(prev - 1, 0);
        
        if (nextIdx !== prev) {
             setMatchedWordCount(0); // Reset highlighting for new line
        }
        return nextIdx;
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (feature !== AiFeature.TELEPROMPTER) return;
    
    // Throttle wheel events
    if (scrollTimeoutRef.current) return;
    
    if (Math.abs(e.deltaY) > 20) {
        handleManualScroll(e.deltaY > 0 ? 'next' : 'prev');
        scrollTimeoutRef.current = setTimeout(() => {
            scrollTimeoutRef.current = null;
        }, 150);
    }
  };

  if (!show) return null;

  // Helper to render text with CJK handling
  const renderSegmentText = (segment: string, tokens: string[], matchedCount: number) => {
      // Basic reconstruction for highlighting. 
      return (
        <span className="break-words">
            {tokens.map((token, idx) => {
                const isMatched = idx < matchedCount;
                const isCurrentCJK = isCJK(token);
                // Determine if we need a space before this token (simplistic approach)
                return (
                    <span 
                        key={idx} 
                        className={`inline-block transition-colors duration-75 ${
                            isMatched ? 'text-green-400' : 'text-white'
                        } ${!isCurrentCJK ? 'mr-1.5' : ''}`}
                    >
                        {token}
                    </span>
                );
            })}
        </span>
      );
  };

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-40 w-full max-w-3xl px-4 animate-in slide-in-from-top-4 duration-500 pointer-events-none">
      <div 
        className="bg-black/70 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden pointer-events-auto"
        onWheel={handleWheel}
      >
        
        {/* Header Badge */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-white/5 cursor-grab active:cursor-grabbing">
            <div className="flex items-center gap-2">
                <span className={`flex h-2 w-2 rounded-full ${feature === AiFeature.INTERVIEWER ? 'bg-blue-400' : 'bg-green-400'} animate-pulse`}></span>
                <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                    {feature === AiFeature.INTERVIEWER ? 'AI Interviewer' : 'Teleprompter'}
                </span>
            </div>
            {feature === AiFeature.TELEPROMPTER && (
                <div className="text-[10px] text-white/40 font-mono">
                    {activeSegmentIndex + 1} / {segments.length}
                </div>
            )}
        </div>

        {/* Content Area */}
        <div className="relative p-6 min-h-[140px] flex flex-col items-center justify-center">
            
            {/* AI Interviewer Mode */}
            {feature === AiFeature.INTERVIEWER && (
                <div className="text-center w-full px-4">
                    {interviewerText ? (
                        <p className="text-xl md:text-2xl font-medium text-white leading-relaxed animate-in fade-in zoom-in-95" style={{ letterSpacing: isCJK(interviewerText) ? '0' : '0.01em' }}>
                        "{interviewerText}"
                        </p>
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-white/30 py-4">
                            <Mic className="w-6 h-6 animate-pulse" />
                            <p className="text-xs font-medium uppercase tracking-wider">Listening for context...</p>
                        </div>
                    )}
                </div>
            )}

            {/* Teleprompter Mode - 3 Line View */}
            {feature === AiFeature.TELEPROMPTER && (
                <div className="w-full flex flex-col items-center space-y-4">
                    
                    {/* Previous Line (Fading out) */}
                    <div 
                        className="h-6 overflow-hidden w-full text-center cursor-pointer opacity-50 hover:opacity-100 transition-opacity"
                        onClick={() => handleManualScroll('prev')}
                    >
                         {activeSegmentIndex > 0 && (
                            <p className="text-sm text-white/20 truncate transition-all duration-500 blur-[0.5px]">
                                {segments[activeSegmentIndex - 1]}
                            </p>
                         )}
                    </div>

                    {/* Active Line (Center Stage) */}
                    <div className="w-full text-center transition-all duration-300 transform px-8">
                        {segments[activeSegmentIndex] ? (
                            <p className="text-2xl md:text-3xl font-bold leading-normal text-white">
                                {renderSegmentText(
                                    segments[activeSegmentIndex], 
                                    segmentTokensMap[activeSegmentIndex], 
                                    matchedWordCount
                                )}
                            </p>
                        ) : (
                            <p className="text-xl text-green-400 font-medium italic">End of script</p>
                        )}
                    </div>

                    {/* Next Line (Preview) */}
                    <div 
                        className="h-8 overflow-hidden w-full text-center cursor-pointer opacity-50 hover:opacity-100 transition-opacity"
                        onClick={() => handleManualScroll('next')}
                    >
                        {activeSegmentIndex < segments.length - 1 && (
                            <p className="text-lg text-white/30 truncate transition-all duration-500">
                                {segments[activeSegmentIndex + 1]}
                            </p>
                        )}
                    </div>

                    {/* Side Controls for Manual Navigation */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2">
                        <button 
                            onClick={() => handleManualScroll('prev')}
                            disabled={activeSegmentIndex === 0}
                            className="p-1.5 rounded-full hover:bg-white/10 text-white/30 hover:text-white transition-all disabled:opacity-0"
                        >
                            <ChevronUp size={24} />
                        </button>
                        <button 
                            onClick={() => handleManualScroll('next')}
                            disabled={activeSegmentIndex >= segments.length - 1}
                            className="p-1.5 rounded-full hover:bg-white/10 text-white/30 hover:text-white transition-all disabled:opacity-0"
                        >
                            <ChevronDown size={24} />
                        </button>
                    </div>

                </div>
            )}
        </div>
      </div>
    </div>
  );
};