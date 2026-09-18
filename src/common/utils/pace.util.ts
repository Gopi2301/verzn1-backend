/**
 * Parses user input pace string (e.g. "6:30", "6.30", "5:00/km", "390") or number into integer seconds per km.
 * Returns null if input is undefined or invalid.
 */
export function parsePaceToSeconds(input?: string | number | null): number | null {
  if (input === undefined || input === null || input === '') {
    return null;
  }

  if (typeof input === 'number') {
    return Math.round(input);
  }

  const cleanStr = String(input).trim().toLowerCase().replace('/km', '').replace('min/km', '').trim();
  
  if (!cleanStr) return null;

  // Handle "MM:SS" or "MM.SS" or "MM"
  if (cleanStr.includes(':') || cleanStr.includes('.')) {
    const separator = cleanStr.includes(':') ? ':' : '.';
    const parts = cleanStr.split(separator);
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1] || '0', 10);

    if (!isNaN(minutes) && !isNaN(seconds)) {
      return minutes * 60 + seconds;
    }
  }

  // Handle raw seconds string e.g. "390"
  const rawSec = parseInt(cleanStr, 10);
  if (!isNaN(rawSec)) {
    return rawSec;
  }

  return null;
}

/**
 * Formats integer seconds per km into "MM:SS min/km" formatted string.
 */
export function formatSecondsToPace(seconds?: number | null): string | null {
  if (seconds === undefined || seconds === null || isNaN(seconds) || seconds <= 0) {
    return null;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  const paddedSecs = secs < 10 ? `0${secs}` : `${secs}`;
  return `${mins}:${paddedSecs} min/km`;
}
