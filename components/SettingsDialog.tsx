import React, { useState } from 'react';
import { X } from 'lucide-react';

interface SettingsDialogProps {
  isOpen: boolean;
  currentScript: string;
  onClose: () => void;
  onSave: (script: string) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen,
  currentScript,
  onClose,
  onSave
}) => {
  const [text, setText] = useState(currentScript);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Teleprompter Script</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        
        <div className="p-4 flex-1 overflow-hidden">
          <textarea
            className="w-full h-64 p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-blue-500 resize-none text-base leading-relaxed"
            placeholder="Paste your script here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-2">
            The AI will listen to you and automatically scroll/highlight the text as you speak.
          </p>
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button 
            onClick={() => { onSave(text); onClose(); }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
          >
            Save Script
          </button>
        </div>
      </div>
    </div>
  );
};
