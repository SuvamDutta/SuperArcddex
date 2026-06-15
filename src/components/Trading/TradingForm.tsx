import React, { useState } from 'react';
import { useStore } from '../../store/useStore';

const TradingForm: React.FC = () => {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [isTrading, setIsTrading] = useState(false);
  const { address, usdcBalance, openPosition, depositUSDC } = useStore();

  const handleTrade = async () => {
    if (!address) {
      alert('Please connect your wallet first.');
      return;
    }
    const margin = parseFloat(amount);
    if (isNaN(margin) || margin <= 0) return;
    
    setIsTrading(true);
    try {
      const type = side === 'buy' ? 'Long' : 'Short';
      await openPosition(type, margin, leverage);
      setAmount('');
    } finally {
      setIsTrading(false);
    }
  };

  const handleDeposit = () => {
    depositUSDC();
  };

  return (
    <div className="trading-form">
      <div className="form-tabs">
        <button 
          className={`tab-btn buy ${side === 'buy' ? 'active' : ''}`}
          onClick={() => setSide('buy')}
        >
          Buy / Long
        </button>
        <button 
          className={`tab-btn sell ${side === 'sell' ? 'active' : ''}`}
          onClick={() => setSide('sell')}
        >
          Sell / Short
        </button>
      </div>

      <div className="input-group">
        <label>Order Type</label>
        <div className="input-wrapper" style={{ background: 'var(--bg-panel-hover)', border: 'none' }}>
          <span style={{color: 'var(--text-main)'}}>Market</span>
        </div>
      </div>

      <div className="input-group">
        <label>Margin</label>
        <div className="input-wrapper">
          <input 
            type="number" 
            placeholder="0.00" 
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span>USDC</span>
        </div>
      </div>

      <div className="input-group">
        <label>Leverage: {leverage}x</label>
        <div className="slider-container">
          <input 
            type="range" 
            min="1" 
            max="20" 
            value={leverage} 
            onChange={(e) => setLeverage(parseInt(e.target.value))}
            className="slider"
          />
        </div>
      </div>

      <div className="balances">
        <span>Available Balance:</span>
        <span style={{color: 'var(--text-main)', fontWeight: 600}}>
          {address ? usdcBalance.toFixed(2) : '0.00'} USDC
        </span>
      </div>

      <button 
        className={`submit-btn ${side}`} 
        onClick={handleTrade}
        disabled={isTrading}
        style={{ opacity: isTrading ? 0.7 : 1, cursor: isTrading ? 'not-allowed' : 'pointer' }}
      >
        {isTrading ? 'Confirming...' : (side === 'buy' ? 'Place Long Order' : 'Place Short Order')}
      </button>

      {address && (
        <button 
          style={{
            marginTop: '12px',
            background: 'transparent',
            border: '1px solid var(--accent-blue)',
            color: 'var(--accent-blue)',
            padding: '8px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
          onClick={handleDeposit}
        >
          Deposit Mock USDC via ARC
        </button>
      )}
    </div>
  );
};

export default TradingForm;
