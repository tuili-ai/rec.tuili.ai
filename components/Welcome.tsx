import React from 'react';

export const Welcome: React.FC = () => {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-br from-[#e0c3fc] to-[#8ec5fc] transition-all duration-700 pointer-events-none">
      <div className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-[0_20px_60px_rgba(0,0,0,0.1)] rounded-[30px] p-12 text-center animate-in slide-in-from-bottom-10 fade-in duration-700">
        <h1 className="text-5xl font-extrabold tracking-tight mb-4 bg-gradient-to-r from-[#0071e3] to-[#a18cd1] bg-clip-text text-transparent">
          TuiliRec
        </h1>
        <p className="text-xl text-gray-500 font-light mb-8">
          Capture your screen like a pro.
        </p>
        <div className="flex items-center justify-center gap-2 text-[#0071e3] font-medium animate-bounce">
          <span className="text-2xl">👇</span>
          <span>Click Initialize below to start</span>
        </div>
      </div>
    </div>
  );
};
