import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import {
  Swords, Clock, TrendingUp, TrendingDown, AlertCircle, Trophy,
  XCircle, Search, Lock, History, ChevronDown, Zap
} from 'lucide-react';

type DuelPhase = 'lobby' | 'matchmaking' | 'selection' | 'active' | 'resolution';
type DuelTab = 'arena' | 'history';

interface DuelRecord {
  id: string;
  date: string;
  opponent: string;
  direction: 'Long' | 'Short';
  leverage: number;
  entryPrice: number;
  userRoi: number;
  botRoi: number;
  result: 'win' | 'loss' | 'draw' | 'forfeit';
  pointsChange: number;   // +1000, -500, 0
  usdcChange: number;     // negative if ROI was negative
}

const LEVERAGE_OPTIONS = [5, 10, 20, 50];

const DuelView: React.FC = () => {
  const {
    address,
    usdcBalance,
    points,
    dailyDuelsCount,
    lastDuelDate,
    deductPoints,
    addPoints,
    deductUSDC,
    incrementDuelCount,
    connectWallet,
    currentPrices,
  } = useStore();

  const [tab, setTab] = useState<DuelTab>('arena');
  const [phase, setPhase] = useState<DuelPhase>('lobby');
  const [timeLeft, setTimeLeft] = useState(60);
  const [errorMsg, setErrorMsg] = useState('');
  const [leverage, setLeverage] = useState(20);
  const [showLevMenu, setShowLevMenu] = useState(false);

  // Game state
  const [userFunds] = useState(100);
  const [userPosition, setUserPosition] = useState<'Long' | 'Short' | null>(null);
  const [userEntryPrice, setUserEntryPrice] = useState(0);
  const [botDirection, setBotDirection] = useState<'Long' | 'Short'>('Long');
  const [botEntryPrice, setBotEntryPrice] = useState(0);

  // Quit / lock state
  const [userHasQuit, setUserHasQuit] = useState(false);
  const [botHasQuit, setBotHasQuit] = useState(false);
  const [lockedUserRoi, setLockedUserRoi] = useState(0);
  const [lockedBotRoi, setLockedBotRoi] = useState(0);

  const [botAddress, setBotAddress] = useState('0x...');
  const [duelResult, setDuelResult] = useState<'win' | 'loss' | 'draw' | 'forfeit' | null>(null);
  const [deductedAmount, setDeductedAmount] = useState(0);
  const [pointsChange, setPointsChange] = useState(0);

  // History
  const [duelHistory, setDuelHistory] = useState<DuelRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem('duelHistory') || '[]'); } catch { return []; }
  });

  const botInterval = useRef<any>(null);
  const timerInterval = useRef<any>(null);

  // ── Refs so interval callbacks always see fresh values ───────────────────────
  const phaseRef          = useRef(phase);
  const userHasQuitRef    = useRef(userHasQuit);
  const botHasQuitRef     = useRef(botHasQuit);
  const lockedUserRoiRef  = useRef(lockedUserRoi);
  const lockedBotRoiRef   = useRef(lockedBotRoi);
  const userPositionRef   = useRef<'Long' | 'Short' | null>(null);
  const userEntryPriceRef = useRef(0);
  const botDirectionRef   = useRef<'Long' | 'Short'>('Long');
  const botEntryPriceRef  = useRef(0);
  const leverageRef       = useRef(leverage);

  // Live BTC price from store (updated by trading engine)
  const currentPrice    = currentPrices['BTCUSDT'] || 65000;
  const currentPriceRef = useRef(currentPrice);

  useEffect(() => { currentPriceRef.current  = currentPrice;  }, [currentPrice]);
  useEffect(() => { phaseRef.current          = phase;          }, [phase]);
  useEffect(() => { userHasQuitRef.current    = userHasQuit;    }, [userHasQuit]);
  useEffect(() => { botHasQuitRef.current     = botHasQuit;     }, [botHasQuit]);
  useEffect(() => { lockedUserRoiRef.current  = lockedUserRoi;  }, [lockedUserRoi]);
  useEffect(() => { lockedBotRoiRef.current   = lockedBotRoi;   }, [lockedBotRoi]);
  useEffect(() => { userPositionRef.current   = userPosition;   }, [userPosition]);
  useEffect(() => { userEntryPriceRef.current = userEntryPrice; }, [userEntryPrice]);
  useEffect(() => { botDirectionRef.current   = botDirection;   }, [botDirection]);
  useEffect(() => { botEntryPriceRef.current  = botEntryPrice;  }, [botEntryPrice]);
  useEffect(() => { leverageRef.current       = leverage;       }, [leverage]);

  // ── ROI formula (identical for user and bot) ─────────────────────────────────
  const calcRoi = (direction: 'Long' | 'Short', entry: number, current: number, lev: number) => {
    if (!entry) return 0;
    const pricePct = (current - entry) / entry;
    return (direction === 'Long' ? pricePct : -pricePct) * lev * 100;
  };

  // ── Derived display values (re-computed every render) ────────────────────────
  const liveUserRoi = userPosition && userEntryPrice
    ? calcRoi(userPosition, userEntryPrice, currentPrice, leverage)
    : 0;
  const liveBotRoi = botEntryPrice
    ? calcRoi(botDirection, botEntryPrice, currentPrice, leverage)
    : 0;

  const effectiveUserRoi = userHasQuit ? lockedUserRoi : liveUserRoi;
  const effectiveBotRoi  = botHasQuit  ? lockedBotRoi  : liveBotRoi;

  const today = new Date().toISOString().split('T')[0];
  const duelsToday = lastDuelDate === today ? dailyDuelsCount : 0;
  const canPlay = points >= 500 && duelsToday < 10;

  const generateBotAddress = () => {
    const chars = '0123456789abcdef';
    let addr = '0x';
    for (let i = 0; i < 40; i++) addr += chars[Math.floor(Math.random() * chars.length)];
    return addr.substring(0, 6) + '...' + addr.substring(38);
  };

  const pushHistory = (record: DuelRecord) => {
    setDuelHistory(prev => {
      const next = [record, ...prev].slice(0, 50);
      localStorage.setItem('duelHistory', JSON.stringify(next));
      return next;
    });
  };

  // ── Matchmaking ─────────────────────────────────────────────────────────────
  const startMatchmaking = () => {
    if (!address) { connectWallet(); return; }
    if (!canPlay) return;
    deductPoints(500);
    incrementDuelCount();
    setErrorMsg('');
    setPhase('matchmaking');
    setTimeout(() => {
      setBotAddress(generateBotAddress());
      startDuel();
    }, 4000);
  };

  // ── Start duel ──────────────────────────────────────────────────────────────
  const startDuel = () => {
    setPhase('selection');
    setTimeLeft(60);
    setUserPosition(null);
    setUserEntryPrice(0);
    setBotDirection('Long');
    setBotEntryPrice(0);
    setUserHasQuit(false);
    setBotHasQuit(false);
    setLockedUserRoi(0);
    setLockedBotRoi(0);
    setDeductedAmount(0);
    setPointsChange(0);

    timerInterval.current = setInterval(() => {
      if (
        phaseRef.current === 'active' &&
        userHasQuitRef.current &&
        botHasQuitRef.current
      ) {
        endDuel(false);
        return;
      }

      setTimeLeft(prev => {
        if (prev <= 1) {
          if (phaseRef.current === 'selection') endDuel(true);
          else if (phaseRef.current === 'active') endDuel(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Open position ────────────────────────────────────────────────────────────
  const openPosition = (type: 'Long' | 'Short') => {
    if (phase !== 'selection') return;

    const entry = currentPriceRef.current;
    setUserPosition(type);
    setUserEntryPrice(entry);

    // Bot picks a direction with 55% chance of choosing opposite (adversarial)
    const botDir: 'Long' | 'Short' = Math.random() > 0.45 ? (type === 'Long' ? 'Short' : 'Long') : type;
    setBotDirection(botDir);
    setBotEntryPrice(entry); // Same entry price as user (fair)

    setPhase('active');
    setTimeLeft(900); // 15 mins

    // Bot quit AI: checks every 20 seconds if it wants to cut loss early
    botInterval.current = setInterval(() => {
      if (botHasQuitRef.current) return;

      const botRoi = calcRoi(botDir, entry, currentPriceRef.current, leverage);

      // Bot quits if it's deeply losing (stop-loss AI at -40%)
      if (botRoi < -40 && Math.random() > 0.5) {
        setLockedBotRoi(botRoi);
        setBotHasQuit(true);
      }
      // Bot locks profit if it's massively winning (>80% roi) — protect gains
      if (botRoi > 80 && Math.random() > 0.7) {
        setLockedBotRoi(botRoi);
        setBotHasQuit(true);
      }
    }, 20000);
  };

  // ── End duel ─────────────────────────────────────────────────────────────────
  const endDuel = (forfeit: boolean) => {
    clearInterval(botInterval.current);
    clearInterval(timerInterval.current);
    setPhase('resolution');

    const lev         = leverageRef.current;
    const btcNow      = currentPriceRef.current;
    const userDir     = userPositionRef.current;
    const userEntry   = userEntryPriceRef.current;
    const botDir      = botDirectionRef.current;
    const botEntry    = botEntryPriceRef.current;

    // ── Compute FINAL ROIs using raw refs (no stale closure) ──────────────────
    // If the player/bot already quit, use their locked ROI; otherwise recalculate now
    const finalUserRoi = userHasQuitRef.current
      ? lockedUserRoiRef.current
      : (userDir && userEntry ? calcRoi(userDir, userEntry, btcNow, lev) : 0);

    const finalBotRoi = botHasQuitRef.current
      ? lockedBotRoiRef.current
      : (botEntry ? calcRoi(botDir, botEntry, btcNow, lev) : 0);

    if (forfeit) {
      setDuelResult('forfeit');
      pushHistory({
        id: Math.random().toString(36).slice(2, 8),
        date: new Date().toLocaleString(),
        opponent: botAddress,
        direction: userDir || 'Long',
        leverage: lev,
        entryPrice: userEntry,
        userRoi: 0,
        botRoi: finalBotRoi,
        result: 'forfeit',
        pointsChange: -500,
        usdcChange: 0,
      });
      return;
    }

    let result: DuelRecord['result'] = 'draw';
    let pts = 0;

    if (finalUserRoi > finalBotRoi) {
      result = 'win';
      pts = 1000;
      addPoints(1000);
    } else if (finalUserRoi < finalBotRoi) {
      result = 'loss';
      pts = -500;
    } else {
      result = 'draw';
      pts = 500;
      addPoints(500);
    }

    setDuelResult(result);
    setPointsChange(pts);

    // ── Deduct USDC: loss% of $100 stake ──────────────────────────────────────
    // e.g. ROI = -30% → lose $30 from balance
    let usdcDelta = 0;
    if (finalUserRoi < 0) {
      usdcDelta = (Math.abs(finalUserRoi) / 100) * 100; // $100 is the stake
      setDeductedAmount(usdcDelta);
      deductUSDC(usdcDelta);
    }

    // Store final resolved ROIs for display in resolution screen
    setLockedUserRoi(finalUserRoi);
    setLockedBotRoi(finalBotRoi);
    setUserHasQuit(true);  // freeze display
    setBotHasQuit(true);

    pushHistory({
      id: Math.random().toString(36).slice(2, 8),
      date: new Date().toLocaleString(),
      opponent: botAddress,
      direction: userDir || 'Long',
      leverage: lev,
      entryPrice: userEntry,
      userRoi: finalUserRoi,
      botRoi: finalBotRoi,
      result,
      pointsChange: pts,
      usdcChange: -usdcDelta,
    });
  };


  const handleCutLoss = () => {
    if (phase !== 'active' || userHasQuit) return;
    setLockedUserRoi(liveUserRoi);
    setUserHasQuit(true);
  };

  const resetLobby = () => {
    setPhase('lobby');
    setDuelResult(null);
    setDeductedAmount(0);
    setPointsChange(0);
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const roiColor = (v: number) => v >= 0 ? '#0ecb81' : '#f6465d';
  const fmtRoi = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="page-container duel-dark-page">

      {/* ── Page Header ── */}
      <div className="portfolio-header-top" style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 className="portfolio-title" style={{ fontSize: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <Swords size={34} color="#0ecb81" /> 1VS1 Trading Challenge
        </h1>
        <p className="portfolio-wallet-address">Risk 500 Points · Trade BTC with real leverage · Win 1000 Points</p>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, justifyContent: 'center' }}>
        {(['arena', 'history'] as DuelTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 28px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, letterSpacing: 0.5,
            background: tab === t ? '#0ecb81' : '#181a20',
            color: tab === t ? '#000' : '#848e9c',
            textTransform: 'capitalize', transition: 'all 0.2s',
          }}>
            {t === 'arena' ? <><Swords size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Arena</> : <><History size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />History</>}
          </button>
        ))}
      </div>

      {/* ════════════════════ ARENA TAB ════════════════════ */}
      {tab === 'arena' && (
        <>
          {/* LOBBY */}
          {phase === 'lobby' && (
            <div className="duel-lobby-card">
              <div className="duel-stats-row">
                <div className="duel-stat-box">
                  <span className="label">Your Points</span>
                  <span className={`value ${points >= 500 ? 'text-green' : 'text-red'}`}>{points.toLocaleString()} pts</span>
                </div>
                <div className="duel-stat-box">
                  <span className="label">Balance</span>
                  <span className="value text-white">${usdcBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="duel-stat-box">
                  <span className="label">Entry Fee</span>
                  <span className="value">500 Points</span>
                </div>
                <div className="duel-stat-box">
                  <span className="label">Daily Left</span>
                  <span className={`value ${duelsToday < 10 ? 'text-white' : 'text-red'}`}>{10 - duelsToday} / 10</span>
                </div>
              </div>

              {/* Leverage selector */}
              <div style={{ margin: '24px 0', display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
                <span style={{ color: '#848e9c', fontSize: 14, fontWeight: 600 }}><Zap size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Choose Leverage:</span>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowLevMenu(o => !o)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, background: '#181a20',
                    border: '1px solid #2b3139', borderRadius: 10, padding: '10px 20px',
                    color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 16
                  }}>
                    {leverage}x <ChevronDown size={14} />
                  </button>
                  {showLevMenu && (
                    <div style={{
                      position: 'absolute', top: '110%', left: 0, background: '#181a20',
                      border: '1px solid #2b3139', borderRadius: 10, overflow: 'hidden',
                      zIndex: 100, minWidth: 100, boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                    }}>
                      {LEVERAGE_OPTIONS.map(lev => (
                        <button key={lev} onClick={() => { setLeverage(lev); setShowLevMenu(false); }} style={{
                          display: 'block', width: '100%', padding: '10px 20px',
                          background: lev === leverage ? 'rgba(14,203,129,0.12)' : 'transparent',
                          border: 'none', color: lev === leverage ? '#0ecb81' : '#fff',
                          cursor: 'pointer', fontWeight: 700, fontSize: 15, textAlign: 'left',
                        }}>
                          {lev}x {lev === 50 ? '🔥' : lev === 20 ? '⚡' : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span style={{ color: '#f6465d', fontSize: 12 }}>
                  {leverage >= 50 ? '⚠️ Extreme Risk' : leverage >= 20 ? '⚠️ High Risk' : 'Moderate Risk'}
                </span>
              </div>

              {errorMsg && <div style={{ color: '#f6465d', marginBottom: '20px', fontWeight: 'bold', textAlign: 'center' }}>{errorMsg}</div>}

              <div className="duel-rules">
                <h3><AlertCircle size={16} /> Rules of the Arena</h3>
                <ul>
                  <li>Pay <strong>500 Points</strong> to enter. Win = <strong>+1000 pts</strong>, Lose = <strong>-500 pts</strong>.</li>
                  <li>Choose your leverage: <strong>5x / 10x / 20x / 50x</strong> (same for both players).</li>
                  <li>You have <strong>1 Minute</strong> to select Long or Short — miss it and you forfeit!</li>
                  <li>Your trade runs for <strong>15 Minutes</strong> locked at the entry BTC price.</li>
                  <li>Both you and the bot use the <strong>same live BTC price</strong> — ROI is calculated identically.</li>
                  <li>Cut Loss early to lock your ROI. Negative ROI = that % of $100 deducted from USDC.</li>
                </ul>
              </div>

              {!address ? (
                <button className="duel-action-btn primary" onClick={connectWallet}>Connect Wallet to Play</button>
              ) : !canPlay ? (
                <button className="duel-action-btn disabled" disabled>
                  {duelsToday >= 10 ? 'Daily Limit Reached' : 'Need 500 Points to Play'}
                </button>
              ) : (
                <button className="duel-action-btn primary pulse-animation" onClick={startMatchmaking}>
                  Pay 500 Points & Find Match
                </button>
              )}
            </div>
          )}

          {/* MATCHMAKING */}
          {phase === 'matchmaking' && (
            <div className="duel-matchmaking-card">
              <div className="radar-spinner" />
              <h2 style={{ marginTop: '30px' }}>Searching for Opponent...</h2>
              <p style={{ color: '#848e9c' }}>Matching you with a player of similar skill level.</p>
            </div>
          )}

          {/* SELECTION / ACTIVE */}
          {(phase === 'selection' || phase === 'active') && (
            <div className="duel-arena">
              {phase === 'selection' && (
                <div className="selection-warning pulse-animation" style={{ backgroundColor: 'rgba(246,70,93,0.1)', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', border: '1px solid #f6465d' }}>
                  <h3 style={{ color: '#f6465d', margin: 0 }}>⚡ SELECTION PHASE</h3>
                  <p style={{ margin: '5px 0 0 0' }}>You have <strong>{timeLeft}s</strong> to punch a trade or forfeit!</p>
                </div>
              )}
              {phase === 'active' && !userHasQuit && (
                <div style={{ backgroundColor: 'rgba(14,203,129,0.1)', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', border: '1px solid #0ecb81' }}>
                  <h3 style={{ color: '#0ecb81', margin: 0 }}><Lock size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> TRADE ACTIVE — {leverage}x Leverage</h3>
                  <p style={{ margin: '5px 0 0 0' }}>Position locked. BTC price moves affect your ROI in real-time.</p>
                </div>
              )}

              <div className="duel-header">
                <div className="timer-box">
                  <Clock size={20} className={timeLeft <= 10 ? 'text-red' : 'text-white'} />
                  <span className={`timer-text ${timeLeft <= 10 ? 'text-red' : ''}`}>
                    {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="btc-price-box">
                  BTC: <span className="font-mono">${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ background: '#181a20', border: '1px solid #2b3139', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: '#0ecb81', fontWeight: 700 }}>
                  {leverage}x Leverage
                </div>
              </div>

              <div className="duel-split-screen">
                {/* USER */}
                <div className="duel-player-card user-card">
                  <h3>You</h3>
                  <div className="roi-display">
                    <span className="roi-value" style={{ color: roiColor(effectiveUserRoi) }}>
                      {phase === 'selection' ? '—' : fmtRoi(effectiveUserRoi)}
                    </span>
                    <span className="roi-label">ROI ({leverage}x)</span>
                  </div>

                  {phase === 'active' && userPosition && (
                    <div style={{ marginTop: 16, background: '#181a20', padding: '12px 16px', borderRadius: 8, fontSize: 13, lineHeight: 1.8 }}>
                      <div><strong>Direction:</strong> <span style={{ color: userPosition === 'Long' ? '#0ecb81' : '#f6465d' }}>{userPosition}</span></div>
                      <div><strong>Entry:</strong> ${userEntryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div><strong>PnL:</strong> <span style={{ color: roiColor(effectiveUserRoi) }}>${((effectiveUserRoi / 100) * userFunds).toFixed(2)}</span></div>
                    </div>
                  )}

                  {phase === 'selection' && (
                    <div className="trading-controls" style={{ marginTop: 20 }}>
                      <button className="long-btn" onClick={() => openPosition('Long')}>
                        <TrendingUp size={16} /> Long
                      </button>
                      <button className="short-btn" onClick={() => openPosition('Short')}>
                        <TrendingDown size={16} /> Short
                      </button>
                    </div>
                  )}

                  {phase === 'active' && !userHasQuit && (
                    <button className="duel-action-btn" style={{ marginTop: 16, background: '#f6465d', border: 'none', color: '#fff', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700 }} onClick={handleCutLoss}>
                      ✂ Cut Loss / Quit Early
                    </button>
                  )}
                  {userHasQuit && (
                    <div style={{ color: '#f6465d', marginTop: 12, fontWeight: 700, fontSize: 13 }}>🔒 ROI Locked at {fmtRoi(lockedUserRoi)}</div>
                  )}
                </div>

                <div className="duel-vs-badge">VS</div>

                {/* BOT / OPPONENT */}
                <div className="duel-player-card opponent-card">
                  <h3 style={{ fontSize: 13 }}>{botAddress}</h3>
                  <div className="roi-display">
                    <span className="roi-value" style={{ color: roiColor(effectiveBotRoi) }}>
                      {phase === 'selection' ? '—' : fmtRoi(effectiveBotRoi)}
                    </span>
                    <span className="roi-label">ROI ({leverage}x)</span>
                  </div>

                  {phase === 'active' && botEntryPrice > 0 && (
                    <div style={{ marginTop: 16, background: '#181a20', padding: '12px 16px', borderRadius: 8, fontSize: 13, lineHeight: 1.8 }}>
                      <div><strong>Direction:</strong> <span style={{ color: botDirection === 'Long' ? '#0ecb81' : '#f6465d' }}>{botDirection}</span></div>
                      <div><strong>PnL:</strong> <span style={{ color: roiColor(effectiveBotRoi) }}>${((effectiveBotRoi / 100) * 100).toFixed(2)}</span></div>
                    </div>
                  )}

                  <div style={{ marginTop: 12, fontSize: 12, color: '#848e9c' }}>
                    {botHasQuit
                      ? <span style={{ color: '#f6465d', fontWeight: 700 }}>🔒 Opponent locked ROI at {fmtRoi(lockedBotRoi)}</span>
                      : phase === 'selection' ? 'Opponent selecting...' : 'Opponent trade running...'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* RESOLUTION */}
          {phase === 'resolution' && (
            <div className={`duel-resolution-card ${duelResult}`}>
              {duelResult === 'win'    && <Trophy   size={64} className="text-green mb-4" />}
              {duelResult === 'loss'   && <XCircle  size={64} className="text-red mb-4" />}
              {duelResult === 'draw'   && <AlertCircle size={64} className="text-yellow mb-4" />}
              {duelResult === 'forfeit'&& <AlertCircle size={64} className="text-red mb-4" />}

              <h1 className="resolution-title">
                {duelResult === 'win' ? '🏆 VICTORY!' : duelResult === 'loss' ? '💀 DEFEAT' : duelResult === 'draw' ? '🤝 DRAW' : '❌ FORFEIT'}
              </h1>

              <div className="resolution-stats">
                <div className="stat-line">
                  <span>Your ROI:</span>
                  <span style={{ color: roiColor(effectiveUserRoi) }}>{fmtRoi(effectiveUserRoi)}</span>
                </div>
                <div className="stat-line">
                  <span>Opponent ROI:</span>
                  <span style={{ color: roiColor(effectiveBotRoi) }}>{fmtRoi(effectiveBotRoi)}</span>
                </div>
                <div className="stat-line">
                  <span>Direction:</span>
                  <span style={{ color: userPosition === 'Long' ? '#0ecb81' : '#f6465d' }}>{userPosition || '—'}</span>
                </div>
                <div className="stat-line">
                  <span>Leverage:</span>
                  <span>{leverage}x</span>
                </div>
              </div>

              <div className="resolution-points" style={{ color: pointsChange > 0 ? '#0ecb81' : pointsChange < 0 ? '#f6465d' : '#848e9c' }}>
                {duelResult === 'win' ? '+1000 Points 🎉' : duelResult === 'loss' ? '-500 Points Lost' : duelResult === 'draw' ? '+500 Points Refunded' : '-500 Points (Forfeit)'}
              </div>

              {deductedAmount > 0 && (
                <div style={{ marginTop: 12, color: '#f6465d', fontWeight: 700, fontSize: 14 }}>
                  ⚠ ${deductedAmount.toFixed(2)} deducted from USDC balance (negative ROI penalty)
                </div>
              )}

              <button className="duel-action-btn primary mt-4" onClick={resetLobby}>Return to Lobby</button>
            </div>
          )}
        </>
      )}

      {/* ════════════════════ HISTORY TAB ════════════════════ */}
      {tab === 'history' && (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {duelHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#848e9c' }}>
              <History size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <div style={{ fontSize: 18, fontWeight: 600 }}>No Duels Yet</div>
              <div style={{ fontSize: 13, marginTop: 8 }}>Complete a duel and your history will appear here.</div>
            </div>
          ) : (
            <>
              {/* Summary row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'Total Duels', value: duelHistory.length },
                  { label: 'Wins', value: duelHistory.filter(d => d.result === 'win').length, color: '#0ecb81' },
                  { label: 'Losses', value: duelHistory.filter(d => d.result === 'loss' || d.result === 'forfeit').length, color: '#f6465d' },
                  {
                    label: 'Total Points',
                    value: duelHistory.reduce((s, d) => s + d.pointsChange, 0),
                    color: duelHistory.reduce((s, d) => s + d.pointsChange, 0) >= 0 ? '#0ecb81' : '#f6465d',
                    prefix: duelHistory.reduce((s, d) => s + d.pointsChange, 0) >= 0 ? '+' : '',
                  },
                ].map(stat => (
                  <div key={stat.label} style={{ background: '#181a20', border: '1px solid #2b3139', borderRadius: 12, padding: '16px 20px' }}>
                    <div style={{ fontSize: 11, color: '#848e9c', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: stat.color || '#fff' }}>{stat.prefix || ''}{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Table */}
              <div style={{ background: '#181a20', border: '1px solid #2b3139', borderRadius: 14, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#0b0e11', borderBottom: '1px solid #2b3139' }}>
                      {['Date', 'Opponent', 'Direction', 'Leverage', 'Your ROI', 'Opp ROI', 'Result', 'Points', 'USDC Δ'].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#848e9c', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {duelHistory.map((d, i) => (
                      <tr key={d.id} style={{ borderBottom: '1px solid #2b3139', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '12px 14px', color: '#848e9c', fontSize: 11 }}>{d.date}</td>
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 11 }}>{d.opponent}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ color: d.direction === 'Long' ? '#0ecb81' : '#f6465d', fontWeight: 700 }}>{d.direction}</span>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#fff' }}>{d.leverage}x</td>
                        <td style={{ padding: '12px 14px', color: roiColor(d.userRoi), fontWeight: 700 }}>{fmtRoi(d.userRoi)}</td>
                        <td style={{ padding: '12px 14px', color: roiColor(d.botRoi), fontWeight: 700 }}>{fmtRoi(d.botRoi)}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: d.result === 'win' ? 'rgba(14,203,129,0.15)' : d.result === 'draw' ? 'rgba(255,193,7,0.15)' : 'rgba(246,70,93,0.15)',
                            color: d.result === 'win' ? '#0ecb81' : d.result === 'draw' ? '#ffc107' : '#f6465d',
                          }}>
                            {d.result.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: d.pointsChange >= 0 ? '#0ecb81' : '#f6465d', fontWeight: 700 }}>
                          {d.pointsChange >= 0 ? '+' : ''}{d.pointsChange}
                        </td>
                        <td style={{ padding: '12px 14px', color: d.usdcChange < 0 ? '#f6465d' : '#848e9c', fontWeight: d.usdcChange < 0 ? 700 : 400 }}>
                          {d.usdcChange < 0 ? `-$${Math.abs(d.usdcChange).toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DuelView;
