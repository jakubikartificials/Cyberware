import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { Download } from 'lucide-react';
import { OfflineModal } from './OfflineModal';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  const handleClick = async () => {
    // If the browser natively provides beforeinstallprompt, trigger it directly
    if (isInstallable) {
      const outcome = await install();
      if (!outcome) {
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-1.5 px-3 py-1 border border-cyan-400 bg-cyan-950/40 text-cyan-400 hover:bg-cyan-400 hover:text-black font-mono text-xs transition-all cursor-pointer shadow-[0_0_12px_rgba(0,240,255,0.25)] active:scale-95"
        title="Offline & Multiplatform Installation Guide"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="font-semibold tracking-wider uppercase">
          {isInstalled ? 'OFFLINE HUB' : 'INSTALL OFFLINE'}
        </span>
      </button>

      <OfflineModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
};
