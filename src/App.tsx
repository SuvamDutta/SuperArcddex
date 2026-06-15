import Navbar from './components/Navbar';
import NetworkGuard from './components/NetworkGuard';
import OrderBook from './components/Trading/OrderBook';
import TradingForm from './components/Trading/TradingForm';
import MarketSelector from './components/Trading/MarketSelector';
import TradingChart from './components/Trading/TradingChart';
import PositionsPanel from './components/Trading/PositionsPanel';
import TopNavigation, { MainTabType } from './components/TopNavigation';
import PortfolioDashboard from './components/Portfolio/PortfolioDashboard';
import LiquidityView from './components/Liquidity/LiquidityView';
import TransferView from './components/Transfer/TransferView';
import DuelView from './components/Duel/DuelView';
import LeaderboardView from './components/LeaderboardView';
import QuestView from './components/QuestView';
import { useState } from 'react';

function App() {
  const [mainTab, setMainTab] = useState<MainTabType>('trade');

  return (
    <NetworkGuard>
      <div className="app-container">
        <Navbar />
        <TopNavigation activeTab={mainTab} onTabChange={setMainTab} />

        {/* All views always mounted — CSS show/hide prevents full remounts.
            This makes tab switching feel instant (no loading flash) and
            preserves scroll positions within each view. */}

        {/* ── TRADE view ── */}
        <div className="tab-view" style={{ display: mainTab === 'trade' ? 'contents' : 'none' }}>
          <MarketSelector />
          <main className="trading-layout">
            <div className="left-column">
              <TradingChart />
              <div className="bottom-panel">
                <div className="panel-content">
                  <PositionsPanel />
                </div>
              </div>
            </div>
            <OrderBook />
            <TradingForm />
          </main>
        </div>

        {/* ── PAGE views (scrollable, full-height) ── */}
        <div className="tab-page-view" style={{ display: mainTab === 'portfolio'   ? 'flex' : 'none' }}><PortfolioDashboard /></div>
        <div className="tab-page-view" style={{ display: mainTab === 'liquidity'   ? 'flex' : 'none' }}><LiquidityView /></div>
        <div className="tab-page-view" style={{ display: mainTab === 'transfer'    ? 'flex' : 'none' }}><TransferView /></div>
        <div className="tab-page-view" style={{ display: mainTab === 'duel'        ? 'flex' : 'none' }}><DuelView /></div>
        <div className="tab-page-view" style={{ display: mainTab === 'leaderboard' ? 'flex' : 'none' }}><LeaderboardView /></div>
        <div className="tab-page-view" style={{ display: mainTab === 'quest'       ? 'flex' : 'none' }}><QuestView /></div>
      </div>
    </NetworkGuard>
  );
}

export default App;
