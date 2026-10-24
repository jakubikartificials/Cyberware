import React, { useState, useEffect } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { Monitor, Smartphone, Terminal, ExternalLink, Download, Check, X, ShieldCheck } from 'lucide-react';

interface OfflineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OfflineModal: React.FC<OfflineModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'desktop' | 'mobile' | 'local'>('desktop');
  const [swRegistered, setSwRegistered] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        setSwRegistered(registrations.length > 0);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 select-none pointer-events-auto">
      <div className="w-full max-w-xl bg-black border border-cyan-400/80 p-6 flex flex-col gap-5 shadow-[0_0_50px_rgba(0,240,255,0.25)] font-mono text-xs text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-wider uppercase text-white">
                OFFLINE & MULTIPLATFORM HUB
              </h2>
              <p className="text-[10px] text-white/50 tracking-wider">
                RUN CYBERWIRE 100% AIR-GAPPED WITHOUT INTERNET
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 border border-white/20 hover:border-white text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cache & Standalone Status Bar */}
        <div className="grid grid-cols-2 gap-2 p-2.5 bg-white/5 border border-white/10 text-[11px]">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`w-4 h-4 ${swRegistered ? 'text-emerald-400' : 'text-amber-400'}`} />
            <div>
              <span className="text-white/40 block text-[9px]">OFFLINE CACHE:</span>
              <span className={swRegistered ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                {swRegistered ? 'ACTIVE (PRECACHED)' : 'INITIALIZING SW'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isInstalled ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
            <div>
              <span className="text-white/40 block text-[9px]">APP STATUS:</span>
              <span className={isInstalled ? 'text-emerald-400 font-semibold' : 'text-cyan-400'}>
                {isInstalled ? 'STANDALONE APP' : 'READY TO INSTALL'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action: If native browser install is active */}
        {isInstallable && (
          <button
            onClick={async () => {
              await install();
            }}
            className="flex items-center justify-center gap-2 w-full py-3 bg-cyan-400 text-black font-bold tracking-widest uppercase hover:bg-cyan-300 transition-colors cursor-pointer shadow-[0_0_20px_rgba(0,240,255,0.4)]"
          >
            <Download className="w-4 h-4" /> 1-CLICK NATIVE BROWSER INSTALL
          </button>
        )}

        {/* Platform Selector Tabs */}
        <div className="flex border-b border-white/20 font-bold">
          <button
            onClick={() => setActiveTab('desktop')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'desktop'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" /> DESKTOP (PC/MAC)
          </button>
          <button
            onClick={() => setActiveTab('mobile')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'mobile'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> MOBILE (IOS/ANDROID)
          </button>
          <button
            onClick={() => setActiveTab('local')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'local'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" /> LOCAL NODE.JS
          </button>
        </div>

        {/* Tab 1: Desktop */}
        {activeTab === 'desktop' && (
          <div className="space-y-3 leading-relaxed text-white/80">
            <p>
              Install CYBERWIRE as a standalone desktop window on <strong>Windows</strong>, <strong>macOS</strong>, <strong>Linux</strong>, or <strong>ChromeOS</strong>:
            </p>

            <div className="p-3 bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">Step 1:</span>
                <span>
                  If previewing inside an iframe, open the app directly in a full browser tab:
                </span>
              </div>
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black border border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> OPEN FULL WINDOW TAB
              </a>

              <div className="flex items-start gap-2 pt-2">
                <span className="text-cyan-400 font-bold">Step 2:</span>
                <span>
                  In <strong>Chrome</strong>, <strong>Edge</strong>, or <strong>Brave</strong>, click the <strong>Install Icon</strong> in your address bar (right side of URL), or open menu <code className="bg-white/10 px-1">⋮</code> $\rightarrow$ <strong>"Install CYBERWIRE"</strong>.
                </span>
              </div>

              <div className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">Step 3:</span>
                <span>
                  Launch from your Desktop shortcut or Applications folder anytime — runs 100% offline with zero internet!
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Mobile */}
        {activeTab === 'mobile' && (
          <div className="space-y-3 leading-relaxed text-white/80">
            <p>
              Add to your phone or tablet home screen for full-screen offline gameplay:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* iOS */}
              <div className="p-3 bg-white/5 border border-white/10 space-y-1.5">
                <div className="text-cyan-400 font-bold uppercase tracking-wider text-[11px]">
                  APPLE IOS (SAFARI)
                </div>
                <ol className="list-decimal list-inside space-y-1 text-white/70 text-[11px]">
                  <li>Open Safari on iPhone or iPad</li>
                  <li>Tap the <strong>Share</strong> button</li>
                  <li>Scroll and tap <strong>"Add to Home Screen"</strong></li>
                  <li>Tap <strong>Add</strong> in top right</li>
                </ol>
              </div>

              {/* Android */}
              <div className="p-3 bg-white/5 border border-white/10 space-y-1.5">
                <div className="text-pink-400 font-bold uppercase tracking-wider text-[11px]">
                  ANDROID (CHROME)
                </div>
                <ol className="list-decimal list-inside space-y-1 text-white/70 text-[11px]">
                  <li>Open Chrome or Firefox</li>
                  <li>Tap the <code className="bg-white/10 px-1">⋮</code> menu</li>
                  <li>Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></li>
                  <li>Launch app icon directly</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Local Node.js */}
        {activeTab === 'local' && (
          <div className="space-y-3 leading-relaxed text-white/80">
            <p>
              Run completely locally on your computer (Mac, PC, Linux, Steam Deck) without needing any cloud connection:
            </p>

            <div className="p-3 bg-black border border-white/20 relative font-mono text-[11px]">
              <div className="text-white/40 mb-1"># Terminal Commands:</div>
              <pre className="text-cyan-300 overflow-x-auto">{`npm install
npm run build
npm run preview`}</pre>
              <button
                onClick={() => handleCopy('npm install && npm run build && npm run preview')}
                className="absolute top-2 right-2 px-2 py-1 bg-white/10 hover:bg-white/20 text-white text-[10px] flex items-center gap-1 cursor-pointer"
              >
                {copiedCmd ? <Check className="w-3 h-3 text-emerald-400" /> : 'COPY'}
              </button>
            </div>

            <p className="text-[11px] text-white/60">
              Then navigate to <code className="text-white">http://localhost:3000</code> in your browser. All procedural 3D models and synthesizers function 100% offline.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-white/20 pt-3 flex items-center justify-between">
          <span className="text-[10px] text-white/40 uppercase">
            ZERO EXTERNAL ASSET DEPENDENCIES
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white text-black font-bold hover:bg-cyan-300 transition-colors cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
