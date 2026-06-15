// ─────────────────────────────────────────────────────────────────────────────
// leaderboardService.ts
// Connects to our custom Node.js WebSocket backend to sync the leaderboard live.
// ─────────────────────────────────────────────────────────────────────────────
import { io, Socket } from 'socket.io-client';

export interface LeaderboardEntry {
  address:      string;
  points:       number;
  winRate:      number;
  totalTrades:  number;
  volume:       number;
  weeklyScore:  number;
  updatedAt:    number;
}

// Connect to the local backend server (port 3001)
// When you publish the backend to a host like Render/Heroku, replace this URL!
const SERVER_URL = 'http://localhost:3001';

let socket: Socket | null = null;

const getSocket = () => {
  if (socket) return socket;
  try {
    socket = io(SERVER_URL);
    return socket;
  } catch (e) {
    console.warn('[SuperArc] WebSocket connection failed:', e);
    return null;
  }
};

export const pushLeaderboardEntry = (entry: LeaderboardEntry): void => {
  const s = getSocket();
  if (s) {
    s.emit('update_entry', entry);
  }
};

export const subscribeLeaderboard = (
  callback: (entries: LeaderboardEntry[]) => void
): (() => void) => {
  const s = getSocket();
  if (!s) return () => {};

  const handleSync = (entries: LeaderboardEntry[]) => {
    entries.sort((a, b) => b.points - a.points);
    callback(entries);
  };

  s.on('leaderboard_sync', handleSync);

  return () => {
    s.off('leaderboard_sync', handleSync);
  };
};

// No longer using Firebase, always true since it's a custom backend
export const isFirebaseReady = (): boolean => true;
export const FIREBASE_ENABLED = true; // Kept for compatibility so the UI knows it's live
