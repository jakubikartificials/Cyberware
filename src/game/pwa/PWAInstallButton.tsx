import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { Download, Share, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running in standalone PWA mode, don't show prompt
  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 font-mono text-[11px]">
        <span className="w-1.5 h-1.5 bg-emerald-400" />
        <span>INSTALLED STANDALONE</span>
      </div>
    );
  }

  return (
    <>
      {isInstallable && (
        <button
          onClick={install}
          className="flex items-center gap-2 px-3 py-1 border border-cyan-400 bg-cyan-950/30 text-cyan-400 hover:bg-cyan-400 hover:text-black font-mono text-xs transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>INSTALL FOR OFFLINE PLAY</span>
        </button>
      )}

      {isIOS && (
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 px-3 py-1 border border-white/30 bg-black/70 text-white/80 hover:text-white hover:border-white font-mono text-xs transition-colors cursor-pointer"
        >
          <Share className="w-3.5 h-3.5 text-cyan-400" />
          <span>INSTALL ON IOS</span>
        </button>
      )}

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
          <div className="w-full max-w-sm border border-cyan-400 bg-black p-6 font-mono text-xs text-white shadow-[0_0_40px_rgba(0,240,255,0.2)]">
            <div className="flex items-center justify-between border-b border-white/20 pb-3 mb-4">
              <span className="text-cyan-400 font-bold uppercase tracking-wider">OFFLINE INSTALL (SAFARI)</span>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="text-white/60 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-white/80 leading-relaxed">
              <p>To run CYBERWIRE completely offline without internet on iPhone or iPad:</p>
              <div className="p-3 bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">1.</span>
                  <span>Tap the <strong>Share</strong> icon in Safari toolbar.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">2.</span>
                  <span>Scroll down and select <strong>Add to Home Screen</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">3.</span>
                  <span>Launch from Home Screen anytime — works 100% offline!</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full py-2.5 bg-white text-black font-bold tracking-wider hover:bg-cyan-300 transition-colors cursor-pointer"
            >
              ACKNOWLEDGE
            </button>
          </div>
        </div>
      )}
    </>
  );
};
