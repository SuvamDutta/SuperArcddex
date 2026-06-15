import React, { useState, useEffect } from 'react';
import { TrendingUp, ArrowDownLeft, ArrowLeftRight, Info, ChevronDown, Plus, Minus, ArrowUpDown, X, Wallet, Lock } from 'lucide-react';
import { BrowserProvider, parseEther } from 'ethers';
import { useStore } from '../../store/useStore';

// ─── Pool definitions ──────────────────────────────────────────────────────────
const POOL_DEFS = [
  { name: 'USDT Pool', asset: 'USDT', color: '#26a17b', totalBase: 980750.25,  usedBase: 498250.00,  utilBase: 50.81, change: 12.45 },
  { name: 'BTC Pool',  asset: 'BTC',  color: '#f7931a', totalBase: 613440.60,  usedBase: 320150.00,  utilBase: 52.19, change: 8.21  },
  { name: 'ETH Pool',  asset: 'ETH',  color: '#627eea', totalBase: 490175.10,  usedBase: 245100.00,  utilBase: 50.00, change: 5.32  },
  { name: 'USDC Pool', asset: 'USDC', color: '#2775ca', totalBase: 245876.80,  usedBase: 122910.00,  utilBase: 50.01, change: -2.14 },
  { name: 'Others Pool', asset: 'Others', color: '#848e9c', totalBase: 128517.75, usedBase: 64460.00, utilBase: 50.17, change: 1.02 },
];

const BASE_TOTAL = POOL_DEFS.reduce((s, p) => s + p.totalBase, 0);

// ─── Trend data ────────────────────────────────────────────────────────────────
const TREND_DATA = [
  { label: 'May 14', value: 1150000 },
  { label: 'May 15', value: 1420000 },
  { label: 'May 16', value: 1680000 },
  { label: 'May 17', value: 1890000 },
  { label: 'May 18', value: 2210000 },
  { label: 'May 19', value: 2680000 },
  { label: 'May 20', value: 2450000 },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtM = (v: number) => {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
};
const fmtFull = (v: number) =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const timeAgo = (ts: number) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const truncateAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

// ─── Donut Chart ───────────────────────────────────────────────────────────────
const DonutChart: React.FC<{ userTotal: number }> = ({ userTotal }) => {
  let deg = 0;
  const stops: string[] = [];
  for (const p of POOL_DEFS) {
    const frac = p.totalBase / BASE_TOTAL;
    stops.push(`${p.color} ${deg}deg ${deg + frac * 360}deg`);
    deg += frac * 360;
  }
  return (
    <div style={{
      position: 'relative', width: 160, height: 160, borderRadius: '50%',
      background: `conic-gradient(${stops.join(', ')})`, flexShrink: 0
    }}>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)', width: 82, height: 82,
        borderRadius: '50%', background: '#181a20',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
      }}>
        <span style={{ fontSize: 9, color: '#848e9c', marginBottom: 2 }}>Total</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{fmtM(BASE_TOTAL + userTotal)}</span>
      </div>
    </div>
  );
};

// ─── SVG Trend Chart ───────────────────────────────────────────────────────────
const TrendChart: React.FC = () => {
  const W = 520, H = 200, PL = 52, PB = 32, PT = 16, PR = 16;
  const vals = TREND_DATA.map(d => d.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const sy = (v: number) => PT + ((max - v) / (max - min)) * (H - PB - PT);
  const sx = (i: number) => PL + (i / (TREND_DATA.length - 1)) * (W - PL - PR);
  const linePath = TREND_DATA.map((d, i) => `${i === 0 ? 'M' : 'L'}${sx(i)},${sy(d.value)}`).join(' ');
  const areaPath = linePath + ` L${sx(TREND_DATA.length - 1)},${H - PB} L${sx(0)},${H - PB} Z`;
  const yTicks = [1000000, 1500000, 2000000, 2500000, 3000000];
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="liqAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ecb81" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0ecb81" stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map(v => (
        <g key={v}>
          <line x1={PL} x2={W - PR} y1={sy(v)} y2={sy(v)} stroke="#2b3139" strokeWidth={1} />
          <text x={PL - 6} y={sy(v) + 4} fill="#848e9c" fontSize={9} textAnchor="end">${(v / 1e6).toFixed(1)}M</text>
        </g>
      ))}
      <path d={areaPath} fill="url(#liqAreaGrad)" />
      <path d={linePath} fill="none" stroke="#0ecb81" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {TREND_DATA.map((d, i) => (
        <circle key={i} cx={sx(i)} cy={sy(d.value)} r={3.5} fill="#0ecb81" stroke="#181a20" strokeWidth={1.5} />
      ))}
      {TREND_DATA.map((d, i) => (
        <text key={i} x={sx(i)} y={H - 4} fill="#848e9c" fontSize={9} textAnchor="middle">{d.label}</text>
      ))}
    </svg>
  );
};

// ─── Health Gauge ──────────────────────────────────────────────────────────────
const HealthGauge: React.FC<{ score: number }> = ({ score }) => {
  const R = 44, CX = 60, CY = 60, circ = 2 * Math.PI * R;
  const arc = (score / 100) * Math.PI * R;
  return (
    <svg width={120} height={80} viewBox="0 0 120 80">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#2b3139" strokeWidth={10}
        strokeDasharray={`${Math.PI * R} ${circ}`} strokeLinecap="round"
        transform={`rotate(180 ${CX} ${CY})`} />
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#0ecb81" strokeWidth={10}
        strokeDasharray={`${arc} ${circ}`} strokeLinecap="round"
        transform={`rotate(180 ${CX} ${CY})`} />
      <text x={CX} y={CY + 4} textAnchor="middle" fill="#fff" fontSize={18} fontWeight={700}>{score}</text>
      <text x={CX} y={CY + 18} textAnchor="middle" fill="#848e9c" fontSize={9}>/100</text>
    </svg>
  );
};

// ─── Add Liquidity Modal ───────────────────────────────────────────────────────
const AddModal: React.FC<{
  pool: typeof POOL_DEFS[0];
  maxBalance: number;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}> = ({ pool, maxBalance, onClose, onConfirm }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [done, setDone] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const num = parseFloat(amount) || 0;
  const invalid = num <= 0 || num > maxBalance;

  // ARC Testnet liquidity vault address
  const LIQUIDITY_VAULT = '0x000000000000000000000000000000000000L1Q1';
  const FEE_ETH = '0.001'; // 0.001 ETH fee on ARC testnet

  const handleSubmit = async () => {
    if (invalid) return;
    setError('');
    setLoading(true);

    try {
      // Step 1: Request MetaMask to send ETH fee on ARC testnet
      if (typeof window !== 'undefined' && window.ethereum) {
        setLoadingMsg('Confirm ETH fee in MetaMask…');
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        const tx = await signer.sendTransaction({
          to: '0x000000000000000000000000000000000000FEE1', // Liquidity fee vault
          value: parseEther(FEE_ETH),
        });

        setLoadingMsg('Waiting for confirmation…');
        await tx.wait();
        setTxHash(tx.hash);
      } else {
        // No MetaMask — simulate 1.2s delay (dev/mock mode)
        setLoadingMsg('Processing…');
        await new Promise(r => setTimeout(r, 1200));
      }

      // Step 2: Record liquidity in store
      setLoadingMsg('Adding liquidity…');
      onConfirm(num);
      setDone(true);
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Transaction failed';
      if (err?.code === 4001) {
        setError('Transaction rejected. Please approve in MetaMask.');
      } else {
        setError(`Error: ${msg}`);
      }
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  return (
    <div className="liq-modal-overlay">
      <div className="liq-modal">
        <button className="liq-modal-close" onClick={onClose}><X size={18} /></button>
        <div className="liq-modal-header">
          <div className="liq-modal-icon" style={{ background: 'rgba(14,203,129,0.12)', color: '#0ecb81' }}><Plus size={20} /></div>
          <div>
            <div className="liq-modal-title">Add Liquidity</div>
            <div className="liq-modal-sub">Adding to <strong style={{ color: pool.color }}>{pool.name}</strong></div>
          </div>
        </div>
        {done ? (
          <div className="liq-modal-success">
            <div style={{ fontSize: 36 }}>✅</div>
            <div className="liq-success-title">Liquidity Added!</div>
            <div className="liq-success-sub">{fmtFull(num)} added to {pool.name}</div>
            {txHash && (
              <div style={{ fontSize: 11, color: '#848e9c', marginTop: 8, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                Tx: {txHash.slice(0, 20)}…{txHash.slice(-6)}
              </div>
            )}
            <div className="liq-modal-info-row" style={{ marginTop: 12 }}>
              <span>ETH Fee Paid</span><span style={{ color: '#f6465d' }}>-{FEE_ETH} ETH</span>
            </div>
            <button className="liq-modal-btn" style={{ background: '#0ecb81', marginTop: 16 }} onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="liq-modal-balance-row">
              <span>Wallet Balance</span>
              <span style={{ color: '#0ecb81', fontWeight: 700 }}>{fmtFull(maxBalance)} USDC</span>
            </div>
            <label className="liq-modal-label">Amount (USDC)</label>
            <div className="liq-modal-input-wrap">
              <input
                type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" className="liq-modal-input"
              />
              <button className="liq-modal-max" onClick={() => setAmount(maxBalance.toFixed(2))}>MAX</button>
            </div>
            {amount && invalid && (
              <div className="liq-modal-error">
                {num <= 0 ? 'Enter a valid amount' : 'Exceeds wallet balance'}
              </div>
            )}
            <div className="liq-modal-info-row">
              <span>Pool APY</span><span style={{ color: '#0ecb81' }}>~12.5%</span>
            </div>
            <div className="liq-modal-info-row">
              <span>Rewards</span><span style={{ color: '#eaecef' }}>ARC Points</span>
            </div>
            <div className="liq-modal-info-row">
              <span>Network Fee</span><span style={{ color: '#f6465d' }}>~0.001 ETH (ARC)</span>
            </div>
            {error && (
              <div className="liq-modal-error" style={{ marginTop: 8 }}>{error}</div>
            )}
            <button
              className="liq-modal-btn" onClick={handleSubmit}
              disabled={loading || invalid}
              style={{ background: invalid ? '#2b3139' : '#0ecb81', color: invalid ? '#848e9c' : '#000', marginTop: 8 }}
            >
              {loading
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #000', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    {loadingMsg || 'Processing…'}
                  </span>
                : 'Add Liquidity'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Remove Liquidity Modal ────────────────────────────────────────────────────
const RemoveModal: React.FC<{
  pool: typeof POOL_DEFS[0];
  deposited: number;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}> = ({ pool, deposited, onClose, onConfirm }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const num = parseFloat(amount) || 0;
  const invalid = num <= 0 || num > deposited;

  const handleSubmit = () => {
    if (invalid) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setDone(true); onConfirm(num); }, 1200);
  };

  return (
    <div className="liq-modal-overlay">
      <div className="liq-modal">
        <button className="liq-modal-close" onClick={onClose}><X size={18} /></button>
        <div className="liq-modal-header">
          <div className="liq-modal-icon" style={{ background: 'rgba(246,70,93,0.12)', color: '#f6465d' }}><Minus size={20} /></div>
          <div>
            <div className="liq-modal-title">Remove Liquidity</div>
            <div className="liq-modal-sub">From <strong style={{ color: pool.color }}>{pool.name}</strong></div>
          </div>
        </div>
        {done ? (
          <div className="liq-modal-success">
            <div style={{ fontSize: 36 }}>✅</div>
            <div className="liq-success-title">Withdrawn!</div>
            <div className="liq-success-sub">{fmtFull(num)} returned to your wallet</div>
            <button className="liq-modal-btn" style={{ background: '#0ecb81', marginTop: 16 }} onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="liq-modal-balance-row">
              <span>Your Deposit</span>
              <span style={{ color: '#f6465d', fontWeight: 700 }}>{fmtFull(deposited)} USDC</span>
            </div>
            <label className="liq-modal-label">Withdraw Amount (USDC)</label>
            <div className="liq-modal-input-wrap">
              <input
                type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" className="liq-modal-input"
              />
              <button className="liq-modal-max" onClick={() => setAmount(deposited.toFixed(2))}>MAX</button>
            </div>
            {amount && invalid && (
              <div className="liq-modal-error">
                {num <= 0 ? 'Enter a valid amount' : 'Exceeds deposited amount'}
              </div>
            )}
            <button
              className="liq-modal-btn" onClick={handleSubmit}
              disabled={loading || invalid}
              style={{ background: invalid ? '#2b3139' : '#f6465d', color: invalid ? '#848e9c' : '#fff', marginTop: 16 }}
            >
              {loading ? 'Processing…' : 'Withdraw'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const LiquidityView: React.FC = () => {
  const { address, usdcBalance, liquidityPositions, liquidityHistory, connectWallet, addLiquidity, removeLiquidity } = useStore();

  const [liveUtil, setLiveUtil] = useState(52.24);
  const [addModal, setAddModal] = useState<typeof POOL_DEFS[0] | null>(null);
  const [removeModal, setRemoveModal] = useState<typeof POOL_DEFS[0] | null>(null);

  useEffect(() => {
    const iv = setInterval(() => setLiveUtil(u => +((u + (Math.random() - 0.5) * 0.1).toFixed(2))), 3000);
    return () => clearInterval(iv);
  }, []);

  // Compute totals including user deposits
  const userTotalDeposited = liquidityPositions.reduce((s, p) => s + p.deposited, 0);
  const platformTotal = BASE_TOTAL + userTotalDeposited;
  const platformUsed  = POOL_DEFS.reduce((s, p) => s + p.usedBase, 0);
  const platformAvail = platformTotal - platformUsed;

  // Recent activity: merge platform static + real wallet history
  const walletActivity = (liquidityHistory || []).slice(0, 8);

  // Compute each pool's real total (base + user deposit in that pool)
  const poolsData = POOL_DEFS.map(p => {
    const userPos = liquidityPositions.find(lp => lp.pool === p.name);
    const userAmt = userPos?.deposited ?? 0;
    const total = p.totalBase + userAmt;
    const avail = total - p.usedBase;
    const util  = (p.usedBase / total) * 100;
    return { ...p, total, used: p.usedBase, available: avail, util, userAmt };
  });

  return (
    <div className="page-container liq-page">
      {/* Modals */}
      {addModal && (
        <AddModal
          pool={addModal}
          maxBalance={usdcBalance}
          onClose={() => setAddModal(null)}
          onConfirm={(amt) => {
            addLiquidity(addModal.name, addModal.asset, addModal.color, amt);
            setTimeout(() => setAddModal(null), 1800);
          }}
        />
      )}
      {removeModal && (() => {
        const pos = liquidityPositions.find(p => p.pool === removeModal.name);
        if (!pos) return null;
        return (
          <RemoveModal
            pool={removeModal}
            deposited={pos.deposited}
            onClose={() => setRemoveModal(null)}
            onConfirm={(amt) => {
              removeLiquidity(removeModal.name, amt);
              setTimeout(() => setRemoveModal(null), 1800);
            }}
          />
        );
      })()}

      {/* ── Header ── */}
      <div className="liq-header">
        <div>
          <h1 className="liq-title">Liquidity</h1>
          <p className="liq-subtitle">Monitor, manage and optimize platform liquidity in real-time.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {address && (
            <div className="liq-wallet-pill">
              <Wallet size={13} />
              <span>{truncateAddr(address)}</span>
              <span className="liq-wallet-bal">{fmtFull(usdcBalance)} USDC</span>
            </div>
          )}
          <div className="liq-updated">
            <span>Last updated: 2 sec ago</span>
            <span className="liq-dot" />
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="liq-body">
        {/* ════ LEFT / CENTER ════ */}
        <div className="liq-main">

          {/* Stat Cards */}
          <div className="liq-stats-row">
            <div className="liq-stat-card">
              <div className="liq-stat-top">
                <span className="liq-stat-label">Total Liquidity</span>
                <div className="liq-stat-icon" style={{ color: '#0ecb81', background: 'rgba(14,203,129,0.12)' }}><TrendingUp size={16} /></div>
              </div>
              <div className="liq-stat-value">{fmtM(platformTotal)}</div>
              <div className="liq-stat-sub positive-text">+15.78% <span>vs last 24h</span></div>
            </div>
            <div className="liq-stat-card">
              <div className="liq-stat-top">
                <span className="liq-stat-label">Used Liquidity</span>
                <div className="liq-stat-icon" style={{ color: '#2962ff', background: 'rgba(41,98,255,0.12)' }}><ArrowUpDown size={16} /></div>
              </div>
              <div className="liq-stat-value">{fmtM(platformUsed)}</div>
              <div className="liq-stat-sub muted-text">{liveUtil.toFixed(2)}% <span>of total</span></div>
            </div>
            <div className="liq-stat-card">
              <div className="liq-stat-top">
                <span className="liq-stat-label">Available Liquidity</span>
                <div className="liq-stat-icon" style={{ color: '#f7931a', background: 'rgba(247,147,26,0.12)' }}><ArrowDownLeft size={16} /></div>
              </div>
              <div className="liq-stat-value">{fmtM(platformAvail)}</div>
              <div className="liq-stat-sub muted-text">{(100 - liveUtil).toFixed(2)}% <span>of total</span></div>
            </div>
            <div className="liq-stat-card">
              <div className="liq-stat-top">
                <span className="liq-stat-label">Liquidity Health</span>
                <div className="liq-stat-icon" style={{ color: '#0ecb81', background: 'rgba(14,203,129,0.12)' }}>🛡</div>
              </div>
              <div className="liq-stat-value" style={{ color: '#0ecb81', fontSize: 20 }}>Excellent</div>
              <div className="liq-stat-sub muted-text">Low risk</div>
            </div>
          </div>

          {/* ── MY LIQUIDITY SECTION ── */}
          {address ? (
            <div className="liq-panel liq-my-panel">
              <div className="liq-panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Wallet size={15} style={{ color: '#2962ff' }} />
                  <span>My Liquidity</span>
                  <span className="liq-my-addr">{truncateAddr(address)}</span>
                </div>
                <div className="liq-my-total-badge">
                  Total Deposited: <strong>{fmtFull(userTotalDeposited)}</strong>
                </div>
              </div>

              {liquidityPositions.length === 0 ? (
                <div className="liq-my-empty">
                  <div style={{ fontSize: 32, marginBottom: 8 }}>💧</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>No liquidity provided yet</div>
                  <div style={{ color: '#848e9c', fontSize: 13 }}>Add liquidity to a pool below to start earning rewards</div>
                </div>
              ) : (
                <div className="liq-my-positions">
                  {liquidityPositions.map(pos => {
                    const poolDef = POOL_DEFS.find(p => p.name === pos.pool)!;
                    const sharePct = (pos.deposited / (poolDef.totalBase + pos.deposited)) * 100;
                    return (
                      <div key={pos.pool} className="liq-my-pos-card">
                        <div className="liq-my-pos-left">
                          <div className="liq-my-pos-dot" style={{ background: pos.color }} />
                          <div>
                            <div className="liq-my-pos-name">{pos.pool}</div>
                            <div className="liq-my-pos-asset" style={{ color: pos.color }}>{pos.asset}</div>
                          </div>
                        </div>
                        <div className="liq-my-pos-stat">
                          <div className="liq-my-pos-label">Deposited</div>
                          <div className="liq-my-pos-value">{fmtFull(pos.deposited)}</div>
                        </div>
                        <div className="liq-my-pos-stat">
                          <div className="liq-my-pos-label">Pool Share</div>
                          <div className="liq-my-pos-value" style={{ color: '#0ecb81' }}>{sharePct.toFixed(4)}%</div>
                        </div>
                        <div className="liq-my-pos-stat">
                          <div className="liq-my-pos-label">Est. APY</div>
                          <div className="liq-my-pos-value" style={{ color: '#0ecb81' }}>~12.5%</div>
                        </div>
                        <div className="liq-my-pos-stat">
                          <div className="liq-my-pos-label">Added</div>
                          <div className="liq-my-pos-value" style={{ color: '#848e9c', fontSize: 11 }}>{timeAgo(pos.addedAt)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="liq-my-add-btn" onClick={() => setAddModal(poolDef)}>
                            <Plus size={13} /> Add
                          </button>
                          <button className="liq-my-remove-btn" onClick={() => setRemoveModal(poolDef)}>
                            <Minus size={13} /> Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Wallet Tx History */}
              {walletActivity.length > 0 && (
                <div className="liq-my-history">
                  <div className="liq-my-history-title">My Transaction History</div>
                  <div className="liq-table-wrapper">
                    <table className="liq-history-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Pool</th>
                          <th>Asset</th>
                          <th>Amount</th>
                          <th>Time</th>
                          <th>Tx ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {walletActivity.map(rec => (
                          <tr key={rec.id}>
                            <td>
                              <span className={`liq-tx-badge ${rec.type === 'deposit' ? 'liq-tx-dep' : 'liq-tx-wit'}`}>
                                {rec.type === 'deposit' ? '↑ Deposit' : '↓ Withdraw'}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600 }}>{rec.pool}</td>
                            <td style={{ color: POOL_DEFS.find(p => p.asset === rec.asset)?.color || '#848e9c', fontWeight: 700 }}>{rec.asset}</td>
                            <td style={{ color: rec.type === 'deposit' ? '#0ecb81' : '#f6465d', fontWeight: 600 }}>
                              {rec.type === 'deposit' ? '+' : '-'}{fmtFull(rec.amount)}
                            </td>
                            <td style={{ color: '#848e9c', fontSize: 12 }}>{timeAgo(rec.timestamp)}</td>
                            <td style={{ color: '#848e9c', fontFamily: 'monospace', fontSize: 11 }}>#{rec.id.toUpperCase()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── Connect Wallet CTA ── */
            <div className="liq-panel liq-connect-cta">
              <div className="liq-connect-inner">
                <div className="liq-connect-icon"><Lock size={28} /></div>
                <div className="liq-connect-text">
                  <div className="liq-connect-title">View Your Liquidity</div>
                  <div className="liq-connect-sub">Connect your wallet to see your deposits, earnings, and transaction history.</div>
                </div>
                <button className="liq-connect-btn" onClick={connectWallet}>
                  <Wallet size={16} /> Connect Wallet
                </button>
              </div>
            </div>
          )}

          {/* Overview + Trend */}
          <div className="liq-mid-row">
            <div className="liq-panel liq-overview-panel">
              <div className="liq-panel-header">
                <span>Liquidity Overview</span>
                <Info size={14} style={{ color: '#848e9c' }} />
              </div>
              <div className="liq-overview-body">
                <DonutChart userTotal={userTotalDeposited} />
                <table className="liq-overview-table">
                  <thead>
                    <tr><th>Asset</th><th>Liquidity</th><th>%</th></tr>
                  </thead>
                  <tbody>
                    {POOL_DEFS.map(p => {
                      const userPos = liquidityPositions.find(lp => lp.pool === p.name);
                      const total = p.totalBase + (userPos?.deposited ?? 0);
                      const pct = (total / (platformTotal || 1)) * 100;
                      return (
                        <tr key={p.asset}>
                          <td><span className="liq-dot-sm" style={{ background: p.color }} />{p.asset}</td>
                          <td>{fmtFull(total)}</td>
                          <td>{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="liq-panel liq-trend-panel">
              <div className="liq-panel-header">
                <span>Liquidity Trend</span>
                <button className="liq-range-btn">7D <ChevronDown size={12} /></button>
              </div>
              <div className="liq-trend-body"><TrendChart /></div>
            </div>
          </div>

          {/* Pools Table */}
          <div className="liq-panel liq-pools-panel">
            <div className="liq-panel-header">
              <span>Liquidity Pools</span>
              <Info size={14} style={{ color: '#848e9c' }} />
            </div>
            <div className="liq-table-wrapper">
              <table className="liq-pools-table">
                <thead>
                  <tr>
                    <th>Pool</th><th>Asset</th><th>Total Liquidity</th>
                    <th>Used</th><th>Available</th><th>Utilization</th>
                    <th>24h Change</th><th>Your Deposit</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {poolsData.map(pool => (
                    <tr key={pool.name} className="liq-pool-row">
                      <td className="liq-pool-name">{pool.name}</td>
                      <td><span className="liq-asset-badge" style={{ color: pool.color }}>{pool.asset}</span></td>
                      <td>{fmtFull(pool.total)}</td>
                      <td>{fmtFull(pool.used)}</td>
                      <td>{fmtFull(pool.available)}</td>
                      <td>
                        <div className="liq-util-cell">
                          <div className="liq-util-bar">
                            <div className="liq-util-fill" style={{ width: `${pool.util}%`, background: pool.util > 70 ? '#f6465d' : '#0ecb81' }} />
                          </div>
                          <span>{pool.util.toFixed(2)}%</span>
                        </div>
                      </td>
                      <td className={pool.change >= 0 ? 'liq-pos' : 'liq-neg'}>
                        {pool.change >= 0 ? '+' : ''}{pool.change.toFixed(2)}%
                      </td>
                      <td>
                        {pool.userAmt > 0
                          ? <span style={{ color: '#0ecb81', fontWeight: 600 }}>{fmtFull(pool.userAmt)}</span>
                          : <span style={{ color: '#848e9c' }}>—</span>
                        }
                      </td>
                      <td>
                        <div className="liq-action-btns">
                          <button
                            className="liq-act-btn liq-act-alloc"
                            title="Add Liquidity"
                            onClick={() => address ? setAddModal(POOL_DEFS.find(p => p.name === pool.name)!) : connectWallet()}
                          >↑</button>
                          <button
                            className="liq-act-btn liq-act-remove"
                            title="Remove"
                            disabled={pool.userAmt === 0}
                            style={{ opacity: pool.userAmt === 0 ? 0.4 : 1 }}
                            onClick={() => pool.userAmt > 0 && setRemoveModal(POOL_DEFS.find(p => p.name === pool.name)!)}
                          >↓</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ════ SIDEBAR ════ */}
        <div className="liq-sidebar">
          {/* Quick Actions */}
          <div className="liq-panel liq-actions-panel">
            <div className="liq-panel-header">Liquidity Actions</div>
            <div className="liq-action-list">
              <button className="liq-action-item" onClick={() => address ? setAddModal(POOL_DEFS[0]) : connectWallet()}>
                <div className="liq-action-icon" style={{ background: 'rgba(14,203,129,0.12)', color: '#0ecb81' }}><Plus size={18} /></div>
                <div className="liq-action-info">
                  <div className="liq-action-name">Allocate Liquidity</div>
                  <div className="liq-action-desc">Add liquidity to assets or pools</div>
                </div>
                <span className="liq-action-arrow">›</span>
              </button>
              <button className="liq-action-item"
                onClick={() => {
                  if (!address) { connectWallet(); return; }
                  const first = liquidityPositions[0];
                  if (first) setRemoveModal(POOL_DEFS.find(p => p.name === first.pool)!);
                }}>
                <div className="liq-action-icon" style={{ background: 'rgba(246,70,93,0.12)', color: '#f6465d' }}><Minus size={18} /></div>
                <div className="liq-action-info">
                  <div className="liq-action-name">Remove Liquidity</div>
                  <div className="liq-action-desc">Remove liquidity from assets</div>
                </div>
                <span className="liq-action-arrow">›</span>
              </button>
              <button className="liq-action-item">
                <div className="liq-action-icon" style={{ background: 'rgba(41,98,255,0.12)', color: '#2962ff' }}><ArrowLeftRight size={18} /></div>
                <div className="liq-action-info">
                  <div className="liq-action-name">Transfer Liquidity</div>
                  <div className="liq-action-desc">Transfer between pools</div>
                </div>
                <span className="liq-action-arrow">›</span>
              </button>
            </div>
          </div>

          {/* Wallet Summary Card */}
          {address && (
            <div className="liq-panel liq-wallet-summary">
              <div className="liq-panel-header">
                <span>My Wallet</span>
              </div>
              <div className="liq-wallet-summary-body">
                <div className="liq-ws-row">
                  <span>USDC Balance</span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{fmtFull(usdcBalance)}</span>
                </div>
                <div className="liq-ws-row">
                  <span>Total Deposited</span>
                  <span style={{ color: '#0ecb81', fontWeight: 700 }}>{fmtFull(userTotalDeposited)}</span>
                </div>
                <div className="liq-ws-row">
                  <span>Active Pools</span>
                  <span style={{ color: '#2962ff', fontWeight: 700 }}>{liquidityPositions.length}</span>
                </div>
                <div className="liq-ws-row">
                  <span>Total Transactions</span>
                  <span style={{ color: '#eaecef', fontWeight: 700 }}>{liquidityHistory.length}</span>
                </div>
                <div className="liq-ws-divider" />
                <div className="liq-ws-row">
                  <span>Est. APY</span>
                  <span style={{ color: '#0ecb81', fontWeight: 700 }}>~12.5%</span>
                </div>
              </div>
            </div>
          )}

          {/* Health Panel */}
          <div className="liq-panel liq-health-panel">
            <div className="liq-panel-header">
              <span>Liquidity Health</span>
              <span className="liq-view-link">View Report</span>
            </div>
            <div className="liq-health-body">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <HealthGauge score={85} />
                <span style={{ color: '#0ecb81', fontSize: 12, fontWeight: 600 }}>Excellent</span>
              </div>
              <div className="liq-health-metrics">
                {[
                  { label: 'Utilization Rate', value: `${liveUtil.toFixed(2)}%` },
                  { label: 'Depth Score', value: 'High' },
                  { label: 'Volatility Risk', value: 'Low' },
                  { label: 'Smart Exposure', value: 'Optimal' },
                ].map(m => (
                  <div key={m.label} className="liq-health-row">
                    <span>{m.label}</span>
                    <span style={{ color: '#0ecb81' }}>{m.value} <span className="liq-bullet">●</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="liq-panel liq-activity-panel">
            <div className="liq-panel-header">
              <span>Recent Activity</span>
              <span className="liq-view-link">View All</span>
            </div>
            <div className="liq-activity-list">
              {walletActivity.length > 0 ? walletActivity.slice(0, 5).map(rec => (
                <div key={rec.id} className="liq-activity-item">
                  <div className="liq-act-icon"
                    style={{ background: rec.type === 'deposit' ? 'rgba(14,203,129,0.12)' : 'rgba(246,70,93,0.12)', color: rec.type === 'deposit' ? '#0ecb81' : '#f6465d' }}>
                    {rec.type === 'deposit' ? '+' : '−'}
                  </div>
                  <div className="liq-act-body">
                    <div className="liq-act-title">{rec.type === 'deposit' ? 'Liquidity Added' : 'Liquidity Removed'}</div>
                    <div className="liq-act-sub">{rec.asset} · {rec.pool}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: '#848e9c', marginBottom: 2 }}>{timeAgo(rec.timestamp)}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: rec.type === 'deposit' ? '#0ecb81' : '#f6465d' }}>
                      {rec.type === 'deposit' ? '+' : '-'}{fmtFull(rec.amount)}
                    </div>
                  </div>
                </div>
              )) : (
                /* Show static activity when no wallet history */
                [
                  { icon: '+', c: '#0ecb81', bg: 'rgba(14,203,129,0.12)', t: 'Liquidity Allocated', s: 'USDT to BTC Pool', ago: '2m ago', amt: '+$250,000' },
                  { icon: '−', c: '#f6465d', bg: 'rgba(246,70,93,0.12)',  t: 'Liquidity Removed',  s: 'ETH from Pool',   ago: '15m ago', amt: '-$120,000' },
                  { icon: '⇄', c: '#2962ff', bg: 'rgba(41,98,255,0.12)', t: 'Liq. Transferred',  s: 'USDC → USDT Pool', ago: '1h ago', amt: '+$75,000' },
                  { icon: '+', c: '#f7931a', bg: 'rgba(247,147,26,0.12)', t: 'Liquidity Allocated', s: 'BTC to ETH Pool', ago: '2h ago', amt: '+$180,000' },
                  { icon: '−', c: '#f6465d', bg: 'rgba(246,70,93,0.12)',  t: 'Liquidity Removed',  s: 'USDT from Pool', ago: '3h ago', amt: '-$50,000' },
                ].map((a, i) => (
                  <div key={i} className="liq-activity-item">
                    <div className="liq-act-icon" style={{ background: a.bg, color: a.c }}>{a.icon}</div>
                    <div className="liq-act-body">
                      <div className="liq-act-title">{a.t}</div>
                      <div className="liq-act-sub">{a.s}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 10, color: '#848e9c', marginBottom: 2 }}>{a.ago}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: a.c }}>{a.amt}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiquidityView;
