import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeftRight, Send, RefreshCw, ChevronDown, X, Wallet,
  Lock, Copy, CheckCircle, AlertTriangle, Clock, TrendingUp,
  ArrowUpRight, ArrowDownLeft, ExternalLink, Zap
} from 'lucide-react';
import { BrowserProvider, parseEther, isAddress } from 'ethers';
import { useStore } from '../../store/useStore';

// ─── Token definitions ─────────────────────────────────────────────────────────
const TOKENS = [
  { symbol: 'USDC', name: 'USD Coin',       color: '#2775ca', bg: 'rgba(39,117,202,0.12)', icon: '💵', decimals: 6  },
  { symbol: 'USDT', name: 'Tether USD',     color: '#26a17b', bg: 'rgba(38,161,123,0.12)', icon: '💰', decimals: 6  },
  { symbol: 'ETH',  name: 'Ethereum',       color: '#627eea', bg: 'rgba(98,126,234,0.12)', icon: '⟠',  decimals: 18 },
  { symbol: 'BTC',  name: 'Bitcoin',        color: '#f7931a', bg: 'rgba(247,147,26,0.12)', icon: '₿',  decimals: 8  },
  { symbol: 'ARC',  name: 'ARC Network',    color: '#00d4ff', bg: 'rgba(0,212,255,0.12)',  icon: '⚡', decimals: 18 },
  { symbol: 'BNB',  name: 'BNB Chain',      color: '#f3ba2f', bg: 'rgba(243,186,47,0.12)', icon: '🔶', decimals: 18 },
];

// Mock prices (USD)
const TOKEN_PRICES: Record<string, number> = {
  USDC: 1.00, USDT: 1.00, ETH: 1677.41, BTC: 64374.53, ARC: 0.42, BNB: 609.59
};

// Mock balances per token (user's testnet wallet)
const MOCK_BALANCES: Record<string, number> = {
  USDC: 10000, USDT: 5000, ETH: 2.45, BTC: 0.085, ARC: 1500, BNB: 3.2
};

// Swap rates matrix (from → to multiplier vs USD)
const getSwapRate = (from: string, to: string) => {
  const fromUsd = TOKEN_PRICES[from] || 1;
  const toUsd   = TOKEN_PRICES[to]   || 1;
  return fromUsd / toUsd;
};

const SWAP_FEE_ETH  = '0.0005';  // ETH fee for swap
const SEND_FEE_ETH  = '0.0008';  // ETH fee for send
const FEE_VAULT     = '0x000000000000000000000000000000000000FEE2';

// ─── Helpers ────────────────────────────────────────────────────────────────────
const fmtNum = (v: number, d = 4) => {
  if (v === 0) return '0';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (Math.abs(v) >= 1e3) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return v.toFixed(d);
};
const fmtUsd = (v: number) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const truncAddr = (a: string) => a ? `${a.slice(0, 8)}…${a.slice(-6)}` : '';
const timeAgo = (ts: number) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// ─── Types ──────────────────────────────────────────────────────────────────────
type TxRecord = {
  id: string;
  type: 'swap' | 'send' | 'receive';
  fromToken?: string; toToken?: string;
  amount: number; toAmount?: number;
  to?: string; from?: string;
  timestamp: number;
  txHash?: string;
  status: 'confirmed' | 'pending' | 'failed';
  feeEth: string;
  usdValue: number;
};

// ─── Token Selector Dropdown ────────────────────────────────────────────────────
const TokenPicker: React.FC<{
  value: string; onChange: (t: string) => void; exclude?: string; label: string;
}> = ({ value, onChange, exclude, label }) => {
  const [open, setOpen] = useState(false);
  const tok = TOKENS.find(t => t.symbol === value)!;
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ fontSize: 11, color: '#848e9c', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, background: '#0b0e11',
          border: '1px solid #2b3139', borderRadius: 10, padding: '10px 14px',
          color: '#fff', cursor: 'pointer', width: '100%', transition: 'border-color 0.2s'
        }}
      >
        <span style={{ fontSize: 20 }}>{tok.icon}</span>
        <div style={{ textAlign: 'left', flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{tok.symbol}</div>
          <div style={{ fontSize: 11, color: '#848e9c' }}>{tok.name}</div>
        </div>
        <ChevronDown size={14} style={{ color: '#848e9c', flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: '#181a20', border: '1px solid #2b3139', borderRadius: 10,
          marginTop: 4, overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.5)'
        }}>
          {TOKENS.filter(t => t.symbol !== exclude).map(t => (
            <button key={t.symbol} onClick={() => { onChange(t.symbol); setOpen(false); }} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 14px', background: t.symbol === value ? 'rgba(41,98,255,0.1)' : 'transparent',
              border: 'none', color: '#fff', cursor: 'pointer', transition: 'background 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = t.symbol === value ? 'rgba(41,98,255,0.1)' : 'transparent')}
            >
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t.symbol}</div>
                <div style={{ fontSize: 11, color: '#848e9c' }}>{t.name}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: '#848e9c' }}>
                {fmtUsd(TOKEN_PRICES[t.symbol])}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Swap Panel ─────────────────────────────────────────────────────────────────
const SwapPanel: React.FC<{
  balances: Record<string, number>;
  onSuccess: (tx: TxRecord) => void;
  connected: boolean;
  onConnect: () => void;
}> = ({ balances, onSuccess, connected, onConnect }) => {
  const { swapToken } = useStore();
  const [fromToken, setFromToken] = useState('USDC');
  const [toToken, setToToken]     = useState('ETH');
  const [fromAmt, setFromAmt]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [loadMsg, setLoadMsg]     = useState('');
  const [error, setError]         = useState('');
  const [done, setDone]           = useState<TxRecord | null>(null);

  const rate    = getSwapRate(fromToken, toToken);
  const numAmt  = parseFloat(fromAmt) || 0;
  const toAmt   = numAmt * rate;
  const maxBal  = balances[fromToken] ?? MOCK_BALANCES[fromToken];
  const invalid = numAmt <= 0 || numAmt > maxBal;
  const usdVal  = numAmt * TOKEN_PRICES[fromToken];

  const flip = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmt('');
    setError('');
  };

  const handleSwap = async () => {
    if (!connected) { onConnect(); return; }
    if (invalid) return;
    setError(''); setLoading(true);
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        setLoadMsg('Confirm fee in MetaMask…');
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const tx = await signer.sendTransaction({ to: FEE_VAULT, value: parseEther(SWAP_FEE_ETH) });
        setLoadMsg('Waiting for confirmation…');
        await tx.wait();
        const record: TxRecord = {
          id: Math.random().toString(36).slice(2, 9),
          type: 'swap', fromToken, toToken,
          amount: numAmt, toAmount: toAmt,
          timestamp: Date.now(), txHash: tx.hash,
          status: 'confirmed', feeEth: SWAP_FEE_ETH,
          usdValue: usdVal
        };
        setDone(record);
        swapToken(fromToken, toToken, numAmt, toAmt, parseFloat(SWAP_FEE_ETH));
        onSuccess(record);
      } else {
        setLoadMsg('Processing swap…');
        await new Promise(r => setTimeout(r, 1400));
        const record: TxRecord = {
          id: Math.random().toString(36).slice(2, 9),
          type: 'swap', fromToken, toToken,
          amount: numAmt, toAmount: toAmt,
          timestamp: Date.now(),
          status: 'confirmed', feeEth: SWAP_FEE_ETH,
          usdValue: usdVal
        };
        setDone(record);
        swapToken(fromToken, toToken, numAmt, toAmt, parseFloat(SWAP_FEE_ETH));
        onSuccess(record);
      }
    } catch (e: any) {
      setError(e?.code === 4001 ? 'Transaction rejected in MetaMask.' : (e?.shortMessage || e?.message || 'Swap failed'));
    } finally {
      setLoading(false); setLoadMsg('');
    }
  };

  const fromTok = TOKENS.find(t => t.symbol === fromToken)!;
  const toTok   = TOKENS.find(t => t.symbol === toToken)!;

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Swap Successful!</div>
        <div style={{ color: '#848e9c', fontSize: 13, marginBottom: 20 }}>
          {fmtNum(done.amount)} {done.fromToken} → {fmtNum(done.toAmount!, 6)} {done.toToken}
        </div>
        {done.txHash && (
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#848e9c', marginBottom: 16 }}>
            Tx: {done.txHash.slice(0, 22)}…{done.txHash.slice(-6)}
          </div>
        )}
        <div className="xfr-info-row"><span>Fee Paid</span><span style={{ color: '#f6465d' }}>-{SWAP_FEE_ETH} ETH</span></div>
        <div className="xfr-info-row"><span>USD Value</span><span style={{ color: '#eaecef' }}>{fmtUsd(done.usdValue)}</span></div>
        <button className="xfr-action-btn xfr-btn-green" style={{ marginTop: 20 }} onClick={() => { setDone(null); setFromAmt(''); }}>
          Swap Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* From */}
      <div className="xfr-token-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <TokenPicker value={fromToken} onChange={setFromToken} exclude={toToken} label="You Pay" />
        </div>
        <div className="xfr-amount-row">
          <input
            type="number" value={fromAmt} onChange={e => setFromAmt(e.target.value)}
            placeholder="0.00" className="xfr-amount-input"
          />
          <button className="xfr-max-btn" onClick={() => setFromAmt(maxBal.toFixed(4))}>MAX</button>
        </div>
        <div className="xfr-balance-hint">
          Balance: <span style={{ color: fromTok.color }}>{fmtNum(maxBal)} {fromToken}</span>
          {numAmt > 0 && <span style={{ color: '#848e9c', marginLeft: 8 }}>≈ {fmtUsd(usdVal)}</span>}
        </div>
      </div>

      {/* Flip button */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button onClick={flip} className="xfr-flip-btn" title="Flip tokens">
          <ArrowLeftRight size={16} />
        </button>
      </div>

      {/* To */}
      <div className="xfr-token-box">
        <TokenPicker value={toToken} onChange={setToToken} exclude={fromToken} label="You Receive" />
        <div className="xfr-amount-row" style={{ marginTop: 10 }}>
          <div className="xfr-amount-display">
            {numAmt > 0 ? fmtNum(toAmt, 6) : '0.00'}
          </div>
          <div style={{ fontSize: 11, color: '#848e9c' }}>
            ≈ {fmtUsd(toAmt * TOKEN_PRICES[toToken])}
          </div>
        </div>
        <div className="xfr-balance-hint">
          Balance: <span style={{ color: toTok.color }}>{fmtNum(balances[toToken] ?? MOCK_BALANCES[toToken])} {toToken}</span>
        </div>
      </div>

      {/* Rate + Fee info */}
      {numAmt > 0 && (
        <div className="xfr-rate-box">
          <div className="xfr-info-row">
            <span>Exchange Rate</span>
            <span>1 {fromToken} = {fmtNum(rate, 6)} {toToken}</span>
          </div>
          <div className="xfr-info-row">
            <span>Network Fee</span>
            <span style={{ color: '#f6465d' }}>~{SWAP_FEE_ETH} ETH (ARC)</span>
          </div>
          <div className="xfr-info-row">
            <span>Slippage</span>
            <span style={{ color: '#0ecb81' }}>0.1%</span>
          </div>
          <div className="xfr-info-row">
            <span>Price Impact</span>
            <span style={{ color: '#0ecb81' }}>&lt;0.01%</span>
          </div>
        </div>
      )}

      {error && <div className="xfr-error">{error}</div>}
      {fromAmt && invalid && (
        <div className="xfr-error">{numAmt <= 0 ? 'Enter a valid amount' : `Insufficient ${fromToken} balance`}</div>
      )}

      <button
        className={`xfr-action-btn ${connected && !invalid ? 'xfr-btn-blue' : 'xfr-btn-disabled'}`}
        onClick={connected ? handleSwap : onConnect}
        disabled={loading || (connected && invalid)}
      >
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span className="xfr-spinner" />
            {loadMsg || 'Processing…'}
          </span>
        ) : connected ? (invalid ? 'Enter Amount' : `Swap ${fromToken} → ${toToken}`) : 'Connect Wallet to Swap'}
      </button>
    </div>
  );
};

// ─── Send Panel ─────────────────────────────────────────────────────────────────
const SendPanel: React.FC<{
  balances: Record<string, number>;
  address: string | null;
  onSuccess: (tx: TxRecord) => void;
  connected: boolean;
  onConnect: () => void;
}> = ({ balances, address, onSuccess, connected, onConnect }) => {
  const { transferToken } = useStore();
  const [token, setToken]     = useState('USDC');
  const [amount, setAmount]   = useState('');
  const [toAddr, setToAddr]   = useState('');
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState('');
  const [error, setError]     = useState('');
  const [done, setDone]       = useState<TxRecord | null>(null);
  const [copied, setCopied]   = useState(false);

  const tok    = TOKENS.find(t => t.symbol === token)!;
  const numAmt = parseFloat(amount) || 0;
  const maxBal = balances[token] ?? MOCK_BALANCES[token];
  const usdVal = numAmt * TOKEN_PRICES[token];
  const addrOk = toAddr.length === 42 && toAddr.startsWith('0x');
  const invalid = numAmt <= 0 || numAmt > maxBal || !addrOk;

  const copyAddr = () => {
    if (address) { navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const handleSend = async () => {
    if (!connected) { onConnect(); return; }
    if (invalid) return;
    setError(''); setLoading(true);
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        setLoadMsg('Confirm fee in MetaMask…');
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const tx = await signer.sendTransaction({ to: FEE_VAULT, value: parseEther(SEND_FEE_ETH) });
        setLoadMsg('Broadcasting transaction…');
        await tx.wait();
        const record: TxRecord = {
          id: Math.random().toString(36).slice(2, 9),
          type: 'send', fromToken: token,
          amount: numAmt, to: toAddr,
          timestamp: Date.now(), txHash: tx.hash,
          status: 'confirmed', feeEth: SEND_FEE_ETH,
          usdValue: usdVal
        };
        setDone(record);
        transferToken(token, numAmt, toAddr, parseFloat(SEND_FEE_ETH));
        onSuccess(record);
      } else {
        setLoadMsg('Sending…');
        await new Promise(r => setTimeout(r, 1400));
        const record: TxRecord = {
          id: Math.random().toString(36).slice(2, 9),
          type: 'send', fromToken: token,
          amount: numAmt, to: toAddr,
          timestamp: Date.now(),
          status: 'confirmed', feeEth: SEND_FEE_ETH,
          usdValue: usdVal
        };
        setDone(record);
        transferToken(token, numAmt, toAddr, parseFloat(SEND_FEE_ETH));
        onSuccess(record);
      }
    } catch (e: any) {
      setError(e?.code === 4001 ? 'Transaction rejected in MetaMask.' : (e?.shortMessage || e?.message || 'Send failed'));
    } finally {
      setLoading(false); setLoadMsg('');
    }
  };

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Transaction Sent!</div>
        <div style={{ color: '#848e9c', fontSize: 13, marginBottom: 20 }}>
          {fmtNum(done.amount)} {done.fromToken} → {truncAddr(done.to!)}
        </div>
        {done.txHash && (
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#848e9c', marginBottom: 16 }}>
            Tx: {done.txHash.slice(0, 22)}…{done.txHash.slice(-6)}
          </div>
        )}
        <div className="xfr-info-row"><span>Fee Paid</span><span style={{ color: '#f6465d' }}>-{SEND_FEE_ETH} ETH</span></div>
        <div className="xfr-info-row"><span>USD Value</span><span style={{ color: '#eaecef' }}>{fmtUsd(done.usdValue)}</span></div>
        <button className="xfr-action-btn xfr-btn-green" style={{ marginTop: 20 }} onClick={() => { setDone(null); setAmount(''); setToAddr(''); }}>
          Send Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TokenPicker value={token} onChange={setToken} label="Token to Send" />

      <div className="xfr-token-box">
        <div className="xfr-amount-row">
          <input
            type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00" className="xfr-amount-input"
          />
          <button className="xfr-max-btn" onClick={() => setAmount(maxBal.toFixed(6))}>MAX</button>
        </div>
        <div className="xfr-balance-hint">
          Balance: <span style={{ color: tok.color }}>{fmtNum(maxBal)} {token}</span>
          {numAmt > 0 && <span style={{ color: '#848e9c', marginLeft: 8 }}>≈ {fmtUsd(usdVal)}</span>}
        </div>
      </div>

      {/* Recipient */}
      <div>
        <div style={{ fontSize: 11, color: '#848e9c', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Recipient Address</div>
        <div style={{ position: 'relative' }}>
          <input
            value={toAddr} onChange={e => setToAddr(e.target.value)}
            placeholder="0x…" className="xfr-addr-input"
            style={{ borderColor: toAddr && !addrOk ? '#f6465d' : '#2b3139' }}
          />
          {addrOk && (
            <CheckCircle size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#0ecb81' }} />
          )}
        </div>
        {toAddr && !addrOk && (
          <div className="xfr-error" style={{ marginTop: 4 }}>Invalid address format</div>
        )}
      </div>

      {/* My address */}
      {address && (
        <div className="xfr-my-addr-row" onClick={copyAddr}>
          <span style={{ color: '#848e9c', fontSize: 11 }}>Your address:</span>
          <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{truncAddr(address)}</span>
          {copied ? <CheckCircle size={12} style={{ color: '#0ecb81' }} /> : <Copy size={12} style={{ color: '#848e9c' }} />}
        </div>
      )}

      <div className="xfr-rate-box">
        <div className="xfr-info-row">
          <span>Network</span><span style={{ color: '#00d4ff' }}>ARC Testnet</span>
        </div>
        <div className="xfr-info-row">
          <span>Network Fee</span><span style={{ color: '#f6465d' }}>~{SEND_FEE_ETH} ETH</span>
        </div>
        <div className="xfr-info-row">
          <span>Estimated Time</span><span style={{ color: '#0ecb81' }}>~3 seconds</span>
        </div>
      </div>

      {error && <div className="xfr-error">{error}</div>}
      {amount && !addrOk && !error && (
        <div className="xfr-error">Please enter a valid recipient address</div>
      )}

      <button
        className={`xfr-action-btn ${connected && !invalid ? 'xfr-btn-purple' : 'xfr-btn-disabled'}`}
        onClick={connected ? handleSend : onConnect}
        disabled={loading || (connected && invalid)}
      >
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span className="xfr-spinner" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
            {loadMsg || 'Sending…'}
          </span>
        ) : connected ? (invalid ? 'Fill in all fields' : `Send ${token}`) : 'Connect Wallet to Send'}
      </button>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────────
const TransferView: React.FC = () => {
  const { address, connectWallet, tokenBalances, usdcBalance, ethBalance } = useStore();
  const baseBalances = tokenBalances || MOCK_BALANCES;
  const balances = {
    ...baseBalances,
    USDC: usdcBalance,
    ETH: ethBalance || baseBalances.ETH,
  };
  const [activeMode, setActiveMode] = useState<'swap' | 'send'>('swap');
  const [txHistory, setTxHistory]   = useState<TxRecord[]>([]);


  const totalUsdValue = Object.entries(balances).reduce(
    (s, [tok, bal]) => s + bal * (TOKEN_PRICES[tok] || 0), 0
  );

  const addTx = useCallback((tx: TxRecord) => {
    setTxHistory(prev => [tx, ...prev]);
  }, []);

  const txIcon = (type: TxRecord['type']) => {
    if (type === 'swap')    return { icon: <ArrowLeftRight size={14} />, color: '#2962ff', bg: 'rgba(41,98,255,0.12)' };
    if (type === 'send')    return { icon: <ArrowUpRight size={14} />,   color: '#f6465d', bg: 'rgba(246,70,93,0.12)' };
    return                         { icon: <ArrowDownLeft size={14} />,  color: '#0ecb81', bg: 'rgba(14,203,129,0.12)' };
  };

  return (
    <div className="page-container xfr-page">
      {/* ── Header ── */}
      <div className="xfr-header">
        <div>
          <h1 className="xfr-title">Transfer & Swap</h1>
          <p className="xfr-subtitle">Swap tokens or send assets to any address on ARC Testnet</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="xfr-network-badge">
            <Zap size={12} style={{ color: '#00d4ff' }} />
            ARC Testnet
          </div>
          {address && (
            <div className="xfr-wallet-pill">
              <Wallet size={13} />
              <span>{truncAddr(address)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="xfr-body">
        {/* ════ LEFT: Balances + Action Panel ════ */}
        <div className="xfr-left">

          {/* Token Balances */}
          <div className="xfr-panel">
            <div className="xfr-panel-header">
              <span>Your Balances</span>
              <span className="xfr-total-val">{fmtUsd(totalUsdValue)}</span>
            </div>
            <div className="xfr-balances-grid">
              {TOKENS.map(tok => {
                const bal = balances[tok.symbol] ?? 0;
                const usd = bal * TOKEN_PRICES[tok.symbol];
                const pct = totalUsdValue > 0 ? (usd / totalUsdValue) * 100 : 0;
                return (
                  <div key={tok.symbol} className="xfr-balance-card" style={{ borderLeft: `3px solid ${tok.color}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: tok.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                        {tok.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{tok.symbol}</div>
                        <div style={{ fontSize: 10, color: '#848e9c' }}>{tok.name}</div>
                      </div>
                      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{fmtNum(bal)}</div>
                        <div style={{ fontSize: 11, color: '#848e9c' }}>{fmtUsd(usd)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 3, background: '#2b3139', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: tok.color, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#848e9c', flexShrink: 0 }}>{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transaction History */}
          <div className="xfr-panel">
            <div className="xfr-panel-header">
              <span>Transaction History</span>
              <span style={{ fontSize: 11, color: '#848e9c' }}>{txHistory.length} total</span>
            </div>
            {txHistory.length === 0 ? (
              <div className="xfr-empty">
                <Clock size={28} style={{ color: '#2b3139', marginBottom: 10 }} />
                <div style={{ fontWeight: 600, color: '#848e9c', fontSize: 14 }}>No transactions yet</div>
                <div style={{ color: '#848e9c', fontSize: 12, marginTop: 4 }}>Your swaps and sends will appear here</div>
              </div>
            ) : (
              <div className="xfr-tx-list">
                {txHistory.map(tx => {
                  const meta = txIcon(tx.type);
                  return (
                    <div key={tx.id} className="xfr-tx-row">
                      <div className="xfr-tx-icon" style={{ background: meta.bg, color: meta.color }}>{meta.icon}</div>
                      <div className="xfr-tx-info">
                        <div className="xfr-tx-title">
                          {tx.type === 'swap' ? `${tx.fromToken} → ${tx.toToken}`
                           : tx.type === 'send' ? `Sent ${tx.fromToken}` : `Received ${tx.fromToken}`}
                        </div>
                        <div className="xfr-tx-sub">
                          {tx.type === 'swap'
                            ? `${fmtNum(tx.amount)} ${tx.fromToken} for ${fmtNum(tx.toAmount!, 6)} ${tx.toToken}`
                            : `${fmtNum(tx.amount)} ${tx.fromToken} to ${truncAddr(tx.to || '')}`}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: tx.type === 'send' ? '#f6465d' : '#0ecb81' }}>
                          {tx.type === 'send' ? '-' : '+'}{fmtUsd(tx.usdValue)}
                        </div>
                        <div style={{ fontSize: 10, color: '#848e9c', marginTop: 2 }}>
                          {timeAgo(tx.timestamp)}
                        </div>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          padding: '1px 6px', borderRadius: 4, marginTop: 3,
                          background: tx.status === 'confirmed' ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)',
                          color: tx.status === 'confirmed' ? '#0ecb81' : '#f6465d', fontSize: 9, fontWeight: 700
                        }}>
                          {tx.status === 'confirmed' ? '✓ Confirmed' : '✗ Failed'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ════ RIGHT: Action Panel ════ */}
        <div className="xfr-right">
          <div className="xfr-panel xfr-action-panel">
            {/* Tab toggle */}
            <div className="xfr-mode-tabs">
              <button
                className={`xfr-mode-tab ${activeMode === 'swap' ? 'active' : ''}`}
                onClick={() => setActiveMode('swap')}
              >
                <ArrowLeftRight size={14} /> Swap
              </button>
              <button
                className={`xfr-mode-tab ${activeMode === 'send' ? 'active' : ''}`}
                onClick={() => setActiveMode('send')}
              >
                <Send size={14} /> Send
              </button>
            </div>

            <div style={{ padding: '20px 20px 24px' }}>
              {!address ? (
                <div className="xfr-connect-cta">
                  <div className="xfr-connect-icon"><Lock size={28} /></div>
                  <div className="xfr-connect-title">Connect Wallet</div>
                  <div className="xfr-connect-sub">Connect your MetaMask wallet to swap tokens or send funds on ARC Testnet</div>
                  <button className="xfr-action-btn xfr-btn-blue" onClick={connectWallet} style={{ marginTop: 16 }}>
                    <Wallet size={15} /> Connect MetaMask
                  </button>
                </div>
              ) : activeMode === 'swap' ? (
                <SwapPanel
                  balances={balances}
                  onSuccess={addTx}
                  connected={!!address}
                  onConnect={connectWallet}
                />
              ) : (
                <SendPanel
                  balances={balances}
                  address={address}
                  onSuccess={addTx}
                  connected={!!address}
                  onConnect={connectWallet}
                />
              )}
            </div>
          </div>

          {/* Info card */}
          <div className="xfr-panel xfr-info-card">
            <div className="xfr-panel-header"><span>Network Info</span></div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Network', value: 'ARC Testnet', color: '#00d4ff' },
                { label: 'Chain ID', value: '5042002', color: '#eaecef' },
                { label: 'Swap Fee', value: `~${SWAP_FEE_ETH} ETH`, color: '#f6465d' },
                { label: 'Send Fee', value: `~${SEND_FEE_ETH} ETH`, color: '#f6465d' },
                { label: 'Block Time', value: '~2 seconds', color: '#0ecb81' },
                { label: 'Finality', value: 'Instant', color: '#0ecb81' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#848e9c' }}>
                  <span>{item.label}</span>
                  <span style={{ color: item.color, fontWeight: 600 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferView;
