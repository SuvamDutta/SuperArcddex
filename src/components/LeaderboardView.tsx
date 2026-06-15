import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Trophy, Users, Zap, Star, AlertTriangle } from 'lucide-react';
import {
  subscribeLeaderboard,
  pushLeaderboardEntry,
  FIREBASE_ENABLED,
  LeaderboardEntry,
} from '../firebase/leaderboardService';
import { calculateWeeklyScore } from '../utils/tradingFormula';

type SortKey = 'points' | 'weeklyScore' | 'winRate' | 'volume' | 'totalTrades';

const truncAddr = (addr: string) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

const LeaderboardView: React.FC = () => {
  const {
    address, walletsData, points, roi,
    tradeHistory, volume,
  } = useStore();

  const [sortKey, setSortKey]           = useState<SortKey>('weeklyScore');
  const [firebaseRows, setFirebaseRows] = useState<LeaderboardEntry[] | null>(null);
  const unsubRef                        = useRef<(() => void) | null>(null);

  // ── Push own data to Firebase whenever points/trades change ─────────────────
  useEffect(() => {
    if (!FIREBASE_ENABLED || !address) return;
    const trades     = tradeHistory || [];
    const wins       = trades.filter(t => t.pnl > 0).length;
    const winRate    = trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0;
    pushLeaderboardEntry({
      address,
      points,
      winRate,
      totalTrades: trades.length,
      volume: volume || 0,
      weeklyScore: calculateWeeklyScore(trades),
      updatedAt: Date.now(),
    });
  }, [address, points, tradeHistory, volume]);

  // ── Subscribe to Firebase live updates ──────────────────────────────────────
  useEffect(() => {
    if (!FIREBASE_ENABLED) return;
    unsubRef.current = subscribeLeaderboard(setFirebaseRows);
    return () => { unsubRef.current?.(); };
  }, []);

  // ── Build rows from localStorage (fallback) ──────────────────────────────────
  const localRows = useMemo(() => {
    const entries = Object.entries(walletsData || {}).map(([addr, data]) => {
      const trades  = data.tradeHistory || [];
      const wins    = trades.filter(t => t.pnl > 0).length;
      const winRate = trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0;
      return {
        address:     addr,
        points:      data.points   || 0,
        winRate,
        totalTrades: trades.length,
        volume:      data.volume   || 0,
        weeklyScore: calculateWeeklyScore(trades),
        updatedAt:   Date.now(),
      };
    });

    // Add current user if missing
    if (address && !entries.find(e => e.address.toLowerCase() === address.toLowerCase())) {
      const trades  = tradeHistory || [];
      entries.push({ 
        address, points, winRate, totalTrades: trades.length, 
        volume: volume || 0, weeklyScore: calculateWeeklyScore(trades), updatedAt: Date.now() 
      });
    }
    return entries;
  }, [walletsData, address, points, tradeHistory, volume]);

  // ── Pick source: Firebase (global) or localStorage (local) ──────────────────
  const rawRows: LeaderboardEntry[] = FIREBASE_ENABLED && firebaseRows !== null
    ? firebaseRows
    : localRows;

  const rows = useMemo(() =>
    [...rawRows]
      .sort((a, b) => b[sortKey] - a[sortKey])
      .map((e, i) => ({
        ...e,
        rank:          i + 1,
        isCurrentUser: e.address.toLowerCase() === (address || '').toLowerCase(),
      })),
    [rawRows, sortKey, address]
  );

  const currentUser = rows.find(r => r.isCurrentUser);

  const rankMedal = (rank: number) => {
    if (rank === 1) return { emoji: '🥇', color: '#F7D060', glow: 'rgba(247,208,96,0.15)' };
    if (rank === 2) return { emoji: '🥈', color: '#C0C0C0', glow: 'rgba(192,192,192,0.1)'  };
    if (rank === 3) return { emoji: '🥉', color: '#cd7f32', glow: 'rgba(205,127,50,0.15)' };
    return null;
  };

  const SORT_TABS: { key: SortKey; label: string }[] = [
    { key: 'weeklyScore', label: 'Weekly Score' },
    { key: 'points',      label: 'Lifetime Points' },
    { key: 'winRate',     label: 'Win Rate' },
    { key: 'volume',      label: 'Volume'   },
  ];

  const totalWeeklyPool = 100000;
  const sumWeeklyScores = rows.reduce((acc, row) => acc + (row.weeklyScore || 0), 0);
  const currentUserEstReward = currentUser && sumWeeklyScores > 0
    ? Math.floor(((currentUser.weeklyScore || 0) / sumWeeklyScores) * totalWeeklyPool)
    : 0;

  return (
    <div className="page-container" style={{ maxWidth: 1000, margin: '0 auto' }}>

      {/* ── Page Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 10 }}>
          <Trophy size={36} color="#F7D060" />
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>Global Leaderboard</h1>
        </div>
        <p style={{ color: '#848e9c', margin: 0, fontSize: 14 }}>
          Live rankings of all traders on SuperArc Dex — sorted by real activity.
        </p>
      </div>

      {/* ── Firebase not configured warning ── */}
      {!FIREBASE_ENABLED && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          background: 'rgba(240,185,11,0.08)', border: '1px solid rgba(240,185,11,0.3)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 24,
        }}>
          <AlertTriangle size={18} color="#f0b90b" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: '#f0b90b', lineHeight: 1.6 }}>
            <strong>Local mode only</strong> — rankings are only visible in this browser.
            To enable a global live leaderboard across all users, ensure the <code>backend/server.js</code> WebSocket server is running.
          </div>
        </div>
      )}

      {/* ── Summary Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { icon: <Users size={18} />,                        label: 'Total Traders', value: rows.length                                        },
          { icon: <Star size={18} color="#F7D060" />,         label: 'Your Rank',    value: currentUser ? `#${currentUser.rank}` : '—'          },
          { icon: <Zap  size={18} color="#00C8FF" />,         label: 'Weekly Score', value: (currentUser?.weeklyScore ?? 0).toLocaleString()     },
          { icon: <Trophy size={18} color="#0ecb81" />,       label: 'Est. Reward',  value: `${currentUserEstReward.toLocaleString()} PTS`     },
        ].map(stat => (
          <div key={stat.label} style={{
            background: '#181a20', border: '1px solid #2b3139',
            borderRadius: 14, padding: '18px 22px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ color: '#848e9c' }}>{stat.icon}</div>
            <div>
              <div style={{ fontSize: 11, color: '#848e9c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Sort Tabs ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {SORT_TABS.map(tab => (
          <button key={tab.key} onClick={() => setSortKey(tab.key)} style={{
            padding: '8px 20px', borderRadius: 8,
            border: `1px solid ${sortKey === tab.key ? '#0ecb81' : '#2b3139'}`,
            background: sortKey === tab.key ? 'rgba(14,203,129,0.1)' : '#181a20',
            color: sortKey === tab.key ? '#0ecb81' : '#848e9c',
            fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.18s',
          }}>
            {tab.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#848e9c' }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: FIREBASE_ENABLED ? '#0ecb81' : '#f0b90b',
            boxShadow: FIREBASE_ENABLED ? '0 0 6px #0ecb81' : '0 0 6px #f0b90b',
          }} />
          {FIREBASE_ENABLED ? 'Live · synced globally' : 'Local · this browser only'}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ background: '#181a20', border: '1px solid #2b3139', borderRadius: 16, overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: '#848e9c' }}>
            <Trophy size={48} style={{ opacity: 0.15, marginBottom: 14 }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>No Traders Yet</div>
            <div style={{ fontSize: 13 }}>Connect your wallet and start trading to appear here.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0b0e11', borderBottom: '1px solid #2b3139' }}>
                {['Rank', 'Trader', 'Win Rate', 'Volume', 'Lifetime Pts', 'Weekly Score'].map(h => (
                  <th key={h} style={{
                    padding: '14px 18px',
                    textAlign: (h === 'Lifetime Pts' || h === 'Volume' || h === 'Weekly Score') ? 'right' : 'left',
                    color: '#848e9c', fontWeight: 600, fontSize: 11,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((user, idx) => {
                const medal = rankMedal(user.rank);
                return (
                  <tr
                    key={user.address}
                    style={{
                      borderBottom: idx < rows.length - 1 ? '1px solid #2b3139' : 'none',
                      background: user.isCurrentUser
                        ? 'rgba(247,208,96,0.04)'
                        : medal ? `linear-gradient(90deg, ${medal.glow} 0%, transparent 40%)`
                        : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    {/* Rank */}
                    <td style={{ padding: '16px 18px', width: 60 }}>
                      {medal ? (
                        <span style={{ fontSize: 22 }}>{medal.emoji}</span>
                      ) : (
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'rgba(255,255,255,0.07)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: '#848e9c',
                        }}>{user.rank}</div>
                      )}
                    </td>

                    {/* Address */}
                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                          background: `hsl(${parseInt(user.address.slice(2, 4), 16) * 1.4}, 60%, 40%)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: '#fff',
                        }}>
                          {user.address.slice(2, 4).toUpperCase()}
                        </div>
                        <div>
                          <div style={{
                            fontFamily: 'monospace', fontSize: 13,
                            fontWeight: user.isCurrentUser ? 800 : 500,
                            color: user.isCurrentUser ? '#F7D060' : '#fff',
                          }}>
                            {user.isCurrentUser
                              ? `You (${truncAddr(user.address)})`
                              : truncAddr(user.address)}
                          </div>
                          {user.isCurrentUser && (
                            <div style={{ fontSize: 10, color: '#0ecb81', marginTop: 1 }}>← You</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Win Rate */}
                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 80, height: 6, background: '#2b3139', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 3, width: `${user.winRate}%`,
                            background: user.winRate >= 60 ? '#0ecb81' : user.winRate >= 40 ? '#f0b90b' : '#f6465d',
                          }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{user.winRate}%</span>
                      </div>
                    </td>

                    {/* Volume */}
                    <td style={{ padding: '16px 18px', textAlign: 'right', fontSize: 13, color: '#fff', fontWeight: 600 }}>
                      ${user.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>

                    {/* Lifetime Points */}
                    <td style={{ padding: '16px 18px', textAlign: 'right', fontSize: 14, color: '#848e9c', fontWeight: 600 }}>
                      {user.points.toLocaleString()}
                    </td>

                    {/* Weekly Score */}
                    <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                      <div style={{
                        fontSize: 18, fontWeight: 800,
                        color: medal ? medal.color : '#00C8FF',
                        textShadow: medal ? `0 0 10px ${medal.glow}` : 'none'
                      }}>
                        {user.weeklyScore?.toLocaleString() || 0}
                      </div>
                      <div style={{ fontSize: 11, color: '#848e9c', marginTop: 4 }}>
                        Est: <span style={{ color: '#0ecb81' }}>
                          {sumWeeklyScores > 0 ? Math.floor(((user.weeklyScore || 0) / sumWeeklyScores) * totalWeeklyPool).toLocaleString() : 0} PTS
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: '#4a5568' }}>
        {FIREBASE_ENABLED
          ? 'Rankings are synced in real-time across all users via WebSocket.'
          : 'Rankings are stored locally. Connect to backend for global sync.'}
      </div>
    </div>
  );
};

export default LeaderboardView;
