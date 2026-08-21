import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

// The beforeinstallprompt event is not part of the standard DOM typings yet.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if the user has already dismissed it this session
    const isDismissed = sessionStorage.getItem('pwa_prompt_dismissed');
    if (isDismissed) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If the app is already installed, hide the prompt
    const handleAppInstalled = () => {
      setIsVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (!isVisible || !deferredPrompt) return null;

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // We no longer need the prompt. Clear it up.
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm bg-ink text-paper p-4 rounded-2xl shadow-card2 z-[100] flex items-center justify-between gap-4 animate-[fadein_0.3s_ease-out]">
      <div className="flex items-center gap-3">
        <div className="bg-paper/10 p-2 rounded-xl">
          <Download className="w-5 h-5 text-paper" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium leading-tight">
            Elchi ilovasini o'rnating va osonroq foydalaning.
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={handleInstallClick}
          className="px-4 py-2 bg-paper text-ink font-semibold text-sm rounded-xl hover:bg-paper/90 transition-colors"
        >
          O'rnatish
        </button>
        <button
          onClick={handleDismiss}
          className="p-2 text-paper/60 hover:text-paper transition-colors rounded-xl hover:bg-paper/10"
          aria-label="Yopish"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
