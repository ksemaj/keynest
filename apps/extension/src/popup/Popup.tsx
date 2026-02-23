import { useEffect, useState } from "react";

export default function Popup() {
  const [desktopConnected, setDesktopConnected] = useState<boolean | null>(null);
  const [currentHostname, setCurrentHostname] = useState<string | null>(null);

  useEffect(() => {
    // Check if desktop app is reachable
    chrome.runtime.sendMessage({ type: "KEYNEST_PING" }, (response) => {
      setDesktopConnected(!!response?.connected);
    });

    // Get current tab hostname
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url;
      if (url) {
        try {
          setCurrentHostname(new URL(url).hostname);
        } catch {
          setCurrentHostname(null);
        }
      }
    });
  }, []);

  return (
    <div className="w-72 bg-[#1c1c1e] text-white font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display',sans-serif]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <span className="font-semibold text-sm">Keynest</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              desktopConnected === null
                ? "bg-white/20"
                : desktopConnected
                ? "bg-emerald-400"
                : "bg-yellow-400"
            }`}
          />
          <span className="text-white/30 text-xs">
            {desktopConnected === null
              ? "…"
              : desktopConnected
              ? "Connected"
              : "App not running"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        {!desktopConnected ? (
          <div className="text-center py-4">
            <p className="text-white/50 text-sm mb-3">
              Open the Keynest desktop app to use autofill
            </p>
            <a
              href="https://keynest.app/download"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 text-sm hover:text-indigo-300"
            >
              Download Keynest →
            </a>
          </div>
        ) : (
          <div className="py-2">
            {currentHostname && (
              <p className="text-white/40 text-xs mb-3">
                Current site: <span className="text-white/60">{currentHostname}</span>
              </p>
            )}
            <p className="text-white/50 text-sm">
              Keynest will automatically suggest logins when you focus a password field.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
