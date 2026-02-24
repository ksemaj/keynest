import { useState } from "react";

interface Props {
  hostname?: string | undefined;
  name: string;
  isSelected?: boolean;
}

/**
 * Shows a service favicon fetched from DuckDuckGo's icon service.
 * Falls back to a letter avatar if the favicon can't be loaded.
 * DuckDuckGo is used instead of Google as a privacy-respecting alternative.
 */
export function FaviconImage({ hostname, name, isSelected }: Props) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");

  const faviconUrl = hostname
    ? `https://icons.duckduckgo.com/ip3/${hostname}.ico`
    : null;

  const initial = name.charAt(0).toUpperCase();

  const avatarClass = `w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
    isSelected ? "bg-indigo-500 text-white" : "bg-white/10 text-white/60"
  }`;

  if (!faviconUrl || state === "error") {
    return <div className={avatarClass}>{initial}</div>;
  }

  return (
    <div className="w-8 h-8 rounded-lg shrink-0 overflow-hidden relative">
      {/* Letter avatar shown while favicon loads */}
      {state === "loading" && (
        <div className={`absolute inset-0 ${avatarClass}`}>{initial}</div>
      )}
      <img
        src={faviconUrl}
        alt=""
        className={`w-full h-full object-contain transition-opacity duration-150 ${
          state === "loaded" ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
      />
    </div>
  );
}
