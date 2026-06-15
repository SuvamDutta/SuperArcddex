import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { Trophy, X, Users } from 'lucide-react';
import './Trading/Leaderboard.css';
import {
  subscribeLeaderboard,
  FIREBASE_ENABLED,
  LeaderboardEntry,
} from '../firebase/leaderboardService';
import { calculateWeeklyScore } from '../utils/tradingFormula';

interface LeaderboardProps {
  onClose: () => void;
}

const truncAddr = (addr: string) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

const Leaderboard: React.FC<LeaderboardProps> = ({ onClose }) => {
  const { address, walletsData, points, roi, tradeHistory } = useStore();

  // Firebase live rows
  const [firebaseRows, setFirebaseRows] = useState<LeaderboardEntry[] | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!FIREBASE_ENABLED) return;
    unsubRef.current = subscribeLeaderboard(setFirebaseRows);
    return () => { unsubRef.current?.(); };
  }, []);

  // Local fallback rows
  const localRows = useMemo(() => {
    const entries = Object.entries(walletsData || {}).map(([addr, data]) => {
      const trades  = data.tradeHistory || [];
      const wins    = trades.filter((t: any) => t.pnl > 0).length;
      const winRate = trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0;
      return { address: addr, points: data.points || 0, winRate, totalTrades: trades.length, volume: data.volume || 0, weeklyScore: calculateWeeklyScore(trades), updatedAt: Date.now() };
    });

    if (address && !entries.find(e => e.address.toLowerCase() === address.toLowerCase())) {
      const trades  = tradeHistory || [];
      const wins    = trades.filter(t => t.pnl > 0).length;
      const winRate = trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0;
      entries.push({ address, points, winRate, totalTrades: trades.length, volume: 0, weeklyScore: calculateWeeklyScore(trades), updatedAt: Date.now() });
    }
    return entries;
  }, [walletsData, address, points, tradeHistory]);

  const rawRows = FIREBASE_ENABLED && firebaseRows !== null ? firebaseRows : localRows;

  const rows = useMemo(() =>
    [...rawRows]
      .sort((a, b) => (b.weeklyScore || 0) - (a.weeklyScore || 0))
      .map((e, i) => ({
        ...e,
        rank:          i + 1,
        isCurrentUser: e.address.toLowerCase() === (address || '').toLowerCase(),
      })),
    [rawRows, address]
  );

  const totalWeeklyPool = 100000;
  const sumWeeklyScores = rows.reduce((acc, row) => acc + (row.weeklyScore || 0), 0);

  return (
    <div className="overlay" style={{ zIndex: 1000 }}>
      <div className="modal" style={{ maxWidth: '620px', padding: '28px', background: 'var(--bg-surface)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div className="title-section">
            <Trophy className="text-yellow" size={24} />
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Global Leaderboard</h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <span className="badge">Season 1 (Weekly)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: FIREBASE_ENABLED ? '#0ecb81' : '#f0b90b',
              boxShadow: FIREBASE_ENABLED ? '0 0 5px #0ecb81' : 'none',
            }} />
            {FIREBASE_ENABLED ? 'Live global sync' : 'Local only'}
            <span style={{ marginLeft: 4 }}>· <Users size={12} style={{ verticalAlign: 'middle' }} /> {rows.length}</span>
          </div>
        </div>

        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <Trophy size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontWeight: 600, marginBottom: 6 }}>No traders yet</div>
            <div style={{ fontSize: 12 }}>Connect your wallet and start trading to appear here.</div>
          </div>
        ) : (
          <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Trader</th>
                  <th>Win Rate</th>
                  <th className="text-right">Weekly Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(user => (
                  <tr key={user.address} className={user.isCurrentUser ? 'highlight-row user-row' : ''}>
                    <td>
                      <div className={`rank-badge ${user.rank <= 3 ? `rank-${user.rank}` : ''}`}>
                        {user.rank <= 3
                          ? ['🥇', '🥈', '🥉'][user.rank - 1]
                          : user.rank}
                      </div>
                    </td>
                    <td className="font-mono text-sm" style={{ fontWeight: user.isCurrentUser ? 700 : 400 }}>
                      {user.isCurrentUser
                        ? `You (${truncAddr(user.address)})`
                        : truncAddr(user.address)}
                    </td>
                    <td>
                      <div className="win-rate-bar">
                        <div className="fill" style={{ width: `${user.winRate}%` }} />
                        <span>{user.winRate}%</span>
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="text-yellow font-bold" style={{ fontSize: '1.1rem' }}>
                        {(user.weeklyScore || 0).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        Est: <span style={{ color: '#0ecb81' }}>{sumWeeklyScores > 0 ? Math.floor(((user.weeklyScore || 0) / sumWeeklyScores) * totalWeeklyPool).toLocaleString() : 0} PTS</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
