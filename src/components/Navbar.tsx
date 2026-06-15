import React, { useState } from 'react';
import { Activity, Wallet, Trophy } from 'lucide-react';
import { useStore } from '../store/useStore';
import Leaderboard from './Leaderboard';

const Navbar: React.FC = () => {
  const { address, points, connectWallet, disconnectWallet } = useStore();
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <>
      <nav className="navbar">
        <div className="nav-left">
          <div className="logo">
            <img src="/logo.png" alt="SuperArc Dex Logo" className="logo-icon" style={{ height: '32px', width: 'auto' }} />
            <span>SuperArc Dex</span>
          </div>
        </div>
        <div className="nav-right">
          {address && (
            <button 
              className="points-badge"
              style={{ cursor: 'pointer', border: '1px solid var(--accent-blue)', background: 'rgba(41, 98, 255, 0.15)' }}
              onClick={() => setShowLeaderboard(true)}
            >
              <Trophy size={16} />
              <span>{points.toLocaleString()} PTS</span>
            </button>
          )}
          {address ? (
            <button 
              className="wallet-address" 
              onClick={disconnectWallet}
              title="Click to disconnect"
              style={{ cursor: 'pointer', border: '1px solid var(--border-color)', background: 'var(--bg-panel)' }}
            >
              {formatAddress(address)}
              <span style={{ fontSize: '10px', marginLeft: '6px', color: 'var(--accent-red)' }}>Disconnect</span>
            </button>
          ) : (
            <button className="connect-btn" onClick={connectWallet}>
              <Wallet size={18} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
              Connect Wallet
            </button>
          )}
        </div>
      </nav>

      {showLeaderboard && (
        <Leaderboard onClose={() => setShowLeaderboard(false)} />
      )}
    </>
  );
};

export default Navbar;
