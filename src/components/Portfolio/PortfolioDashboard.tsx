import React, { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import PortfolioChart from '../Trading/PortfolioChart';
import { Wallet, Lock } from 'lucide-react';

// Same prices used in Transfer section — single source of truth
const TOKEN_PRICES: Record<string, number> = {
  USDC: 1.00, USDT: 1.00, ETH: 1677.41, BTC: 64374.53, ARC: 0.42, BNB: 609.59
};

const TOKEN_COLORS: Record<string, string> = {
  USDC: '#2775ca', USDT: '#26a17b', ETH: '#627eea',
  BTC: '#f7931a', ARC: '#00d4ff', BNB: '#f3ba2f',
};

const PortfolioDashboard: React.FC = () => {
  const { 
    address, 
    usdcBalance,
    ethBalance,
    tokenBalances,
    positions,
    tradeHistory, 
    connectWallet 
  } = useStore();

  // Build live balances: tokenBalances is source of truth,
  // but always prefer the dedicated usdcBalance / ethBalance fields (kept in sync by store)
  const liveBalances: Record<string, number> = {
    ...(tokenBalances || {}),
    USDC: usdcBalance,
    ETH: ethBalance || (tokenBalances?.ETH ?? 0),
  };

  const totalValue = Object.entries(liveBalances).reduce(
    (sum, [tok, bal]) => sum + (bal || 0) * (TOKEN_PRICES[tok] || 0), 0
  );

  const assets = Object.entries(liveBalances)
    .map(([symbol, bal]) => ({
      symbol,
      value: (bal || 0) * (TOKEN_PRICES[symbol] || 0),
      color: TOKEN_COLORS[symbol] || '#848e9c',
    }))
    .filter(a => a.value > 0)
    .sort((a, b) => b.value - a.value);


  let currentPct = 0;
  const gradientStops = assets.map(a => {
    const pct = totalValue > 0 ? (a.value / totalValue) * 100 : 0;
    const start = currentPct;
    const end = currentPct + pct;
    currentPct = end;
    return `${a.color} ${start}% ${end}%`;
  });
  const conicGradient = gradientStops.length > 0 
    ? `conic-gradient(${gradientStops.join(', ')})`
    : 'conic-gradient(#2b3139 0% 100%)';

  const { totalProfit, totalLoss, winRate } = useMemo(() => {
    let profit = 0;
    let loss = 0;
    let wins = 0;
    
    if (!tradeHistory) return { totalProfit: 0, totalLoss: 0, winRate: 0 };

    tradeHistory.forEach(trade => {
      if (trade.pnl >= 0) {
        profit += trade.pnl;
        wins++;
      } else {
        loss += Math.abs(trade.pnl);
      }
    });

    const totalTrades = tradeHistory.length;
    const wr = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    return { totalProfit: profit, totalLoss: loss, winRate: wr };
  }, [tradeHistory]);

  const truncateAddr = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const formatCurrency = (val: number) => {
    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (!address) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div className="portfolio-connect-card">
          <div className="lock-icon-wrapper">
            <Lock size={40} className="lock-icon" />
          </div>
          <h2>Access Your Portfolio</h2>
          <p>Connect your Web3 wallet to track your assets, trading performance, history, and loyalty points on ARC Network.</p>
          <button className="connect-btn-large" onClick={connectWallet}>
            <Wallet size={20} style={{ marginRight: '8px' }} />
            Connect Web3 Wallet
          </button>
        </div>
      </div>
    );
  }

  // Combine Trade History and Active Positions for the table
  const allTrades = [
    ...(positions || []).map(p => ({
      id: p.id,
      market: p.market,
      type: p.type,
      entryPrice: p.entryPrice,
      closePrice: null, // Open
      size: p.size,
      pnl: 0, // In a real app we'd calc unrealized PNL
      status: 'Open'
    })),
    ...(tradeHistory || []).map(t => ({
      id: t.id,
      market: t.market,
      type: t.type,
      entryPrice: t.entryPrice,
      closePrice: t.closePrice,
      size: t.size,
      pnl: t.pnl,
      status: 'Closed'
    }))
  ].slice(0, 50); // Just take the latest 50 for the table

  return (
    <div className="page-container portfolio-dark-page">
      <div className="portfolio-header-top">
        <h1 className="portfolio-title">Portfolio Overview</h1>
        <p className="portfolio-wallet-address">Wallet: {truncateAddr(address)}</p>
      </div>

      <div className="portfolio-top-stats">
        <div className="p-stat-card">
          <div className="p-stat-label">Total Value</div>
          <div className="p-stat-value total-value">{formatCurrency(totalValue)}</div>
        </div>
        <div className="p-stat-card">
          <div className="p-stat-label">Total Profit</div>
          <div className="p-stat-value profit-value">{totalProfit > 0 ? '+' : ''}{formatCurrency(totalProfit)}</div>
        </div>
        <div className="p-stat-card">
          <div className="p-stat-label">Total Loss</div>
          <div className="p-stat-value loss-value">{formatCurrency(totalLoss)}</div>
        </div>
        <div className="p-stat-card">
          <div className="p-stat-label">Win Rate</div>
          <div className="p-stat-value winrate-value">{winRate.toFixed(1)}%</div>
        </div>
      </div>

      <div className="portfolio-middle-row">
        <div className="p-panel performance-panel">
          <div className="p-panel-header">Performance</div>
          <div className="p-chart-container">
            <PortfolioChart />
          </div>
        </div>

        <div className="p-panel allocation-panel">
          <div className="p-panel-header">Capital Allocation</div>
          <div className="allocation-content">
            <div className="pie-chart-wrapper">
              <div className="pie-chart" style={{ background: conicGradient }}></div>
            </div>
            <div className="allocation-legend">
              {assets.length === 0 ? (
                <div style={{ color: '#848e9c', fontSize: 13 }}>No assets found</div>
              ) : (
                assets.map(a => (
                  <div className="legend-item" key={a.symbol}>
                    <div className="legend-color" style={{ background: a.color }}></div>
                    <span>{a.symbol}</span>
                    <span className="legend-pct">
                      {totalValue > 0 ? ((a.value / totalValue) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-panel history-panel">
        <div className="p-panel-header">Trade History</div>
        <div className="p-table-wrapper">
          <table className="p-trade-table">
            <thead>
              <tr>
                <th>Trade ID</th>
                <th>Pair</th>
                <th>Side</th>
                <th>Entry Price</th>
                <th>Exit Price</th>
                <th>Size</th>
                <th>PNL</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {allTrades.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: '#848e9c' }}>No trades yet</td>
                </tr>
              ) : (
                allTrades.map((trade) => {
                  const isBuy = trade.type === 'Long';
                  const isClosed = trade.status === 'Closed';
                  const isWin = trade.pnl >= 0;
                  
                  // Format pair with slash (e.g. BTC/USDT)
                  const pairName = trade.market.replace('USDT', '/USDT');

                  return (
                    <tr key={trade.id}>
                      <td className="trade-id">TRD-{trade.id.substring(0, 3).toUpperCase()}</td>
                      <td>{pairName}</td>
                      <td>{isBuy ? 'Buy' : 'Sell'}</td>
                      <td>{trade.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td>{isClosed ? trade.closePrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                      <td>{trade.size.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC</td>
                      <td className={!isClosed ? 'pnl-open' : (isWin ? 'pnl-win' : 'pnl-loss')}>
                        {isClosed ? `${isWin ? '+' : '-'}${formatCurrency(Math.abs(trade.pnl))}` : '-'}
                      </td>
                      <td className={trade.status === 'Closed' ? 'status-closed' : 'status-open'}>
                        {trade.status}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PortfolioDashboard;
