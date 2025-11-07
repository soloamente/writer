/**
 * Cursor settings management
 * Stores cursor preferences in localStorage
 */

export type CursorBlinkStyle = "solid" | "blink" | "smooth" | "pulse";

export interface CursorSettings {
  blinkStyle: CursorBlinkStyle;
  blinkDuration: number; // in seconds
}

const STORAGE_KEY = "cursor-settings";

const DEFAULT_SETTINGS: CursorSettings = {
  blinkStyle: "smooth",
  blinkDuration: 1.2,
};

/**
 * Get cursor settings from localStorage or return defaults
 */
export function getCursorSettings(): CursorSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<CursorSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
      };
    }
  } catch (error) {
    console.error("Failed to load cursor settings:", error);
  }

  return DEFAULT_SETTINGS;
}

/**
 * Save cursor settings to localStorage
 */
export function saveCursorSettings(settings: Partial<CursorSettings>): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const current = getCursorSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    
    // Dispatch custom event so components can react to changes
    window.dispatchEvent(new CustomEvent("cursor-settings-changed", { detail: updated }));
  } catch (error) {
    console.error("Failed to save cursor settings:", error);
  }
}

/**
 * Get blink animation configuration based on style
 * Uses optimized easing curves for smooth, natural-feeling animations
 */
export function getBlinkAnimation(
  style: CursorBlinkStyle,
  duration: number
): {
  opacity: number[];
  times: number[];
  ease: number[];
} {
  switch (style) {
    case "solid":
      // No blinking - always visible
      return {
        opacity: [1],
        times: [0],
        ease: [0.25, 0.46, 0.45, 0.94], // ease-out-quad
      };
    case "blink":
      // Classic blink - sharp on/off transition
      // Uses ease-in-out for slightly smoother edges
      return {
        opacity: [1, 0, 1],
        times: [0, 0.5, 1],
        ease: [0.645, 0.045, 0.355, 1], // ease-in-out-cubic for subtle smoothing
      };
    case "smooth":
      // Smooth fade in/out with natural timing
      // Stays visible longer, fades quickly, then returns smoothly
      return {
        opacity: [1, 1, 0, 0, 1, 1],
        times: [0, 0.35, 0.5, 0.65, 0.85, 1],
        ease: [0.215, 0.61, 0.355, 1], // ease-out-cubic for smooth fade
      };
    case "pulse":
      // Gentle breathing effect - never fully disappears
      // Smooth oscillation between visible states
      return {
        opacity: [1, 0.4, 1],
        times: [0, 0.5, 1],
        ease: [0.455, 0.03, 0.515, 0.955], // ease-in-out-quad for natural pulse
      };
    default:
      // Default to smooth
      return {
        opacity: [1, 1, 0, 0, 1, 1],
        times: [0, 0.35, 0.5, 0.65, 0.85, 1],
        ease: [0.215, 0.61, 0.355, 1], // ease-out-cubic
      };
  }
}


