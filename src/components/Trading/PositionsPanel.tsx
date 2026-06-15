import React, { useState } from 'react';
import { useStore, Position } from '../../store/useStore';

const PositionsPanel: React.FC = () => {
  const { address, positions, currentPrices, closePosition, updatePositionTPSL } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tpInput, setTpInput] = useState<string>('');
  const [slInput, setSlInput] = useState<string>('');

  const handleEditClick = (pos: Position) => {
    setEditingId(pos.id);
    setTpInput(pos.tpPrice ? pos.tpPrice.toString() : '');
    setSlInput(pos.slPrice ? pos.slPrice.toString() : '');
  };

  const calculateExpectedPnL = (pos: Position, targetPriceStr: string) => {
    if (!targetPriceStr) return null;
    const targetPrice = parseFloat(targetPriceStr);
    if (isNaN(targetPrice) || targetPrice <= 0) return null;
    
    const priceDiff = targetPrice - pos.entryPrice;
    const pnlPercentage = priceDiff / pos.entryPrice;
    return pos.type === 'Long' ? pos.size * pnlPercentage : pos.size * -pnlPercentage;
  };

  const handleSave = (id: string) => {
    updatePositionTPSL(
      id, 
      tpInput ? parseFloat(tpInput) : undefined, 
      slInput ? parseFloat(slInput) : undefined
    );
    setEditingId(null);
  };

  return (
    <div className="positions-container">
      <div className="pos-header">
        <h4>Open Positions {address ? `(${positions.length})` : ''}</h4>
      </div>
      <div className="pos-body">
        {!address ? (
          <div className="empty-state">Please connect your wallet to view your portfolio</div>
        ) : positions.length === 0 ? (
          <div className="empty-state">No open positions</div>
        ) : (
          <div className="pos-table-wrapper">
            <table className="pos-table">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Side</th>
                  <th>Size</th>
                  <th>Entry Price</th>
                  <th>Liq. Price</th>
                  <th>Mark Price</th>
                  <th>TP / SL</th>
                  <th>Unrealized PnL</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map(pos => {
                  const currentPrice = currentPrices[pos.market] || pos.entryPrice;
                  const priceDiff = currentPrice - pos.entryPrice;
                  const pnlPercentage = priceDiff / pos.entryPrice;
                  let pnl = pos.type === 'Long' ? pos.size * pnlPercentage : pos.size * -pnlPercentage;
                  const isPositive = pnl >= 0;

                  return (
                    <tr key={pos.id}>
                      <td style={{fontWeight: 600}}>{pos.market}</td>
                      <td className={pos.type === 'Long' ? 'positive' : 'negative'}>
                        {pos.type} {pos.leverage}x
                      </td>
                      <td>{pos.size.toFixed(2)} USDC</td>
                      <td>${pos.entryPrice.toFixed(2)}</td>
                      <td style={{ color: 'var(--accent-red)' }}>${pos.liqPrice.toFixed(2)}</td>
                      <td>${currentPrice.toFixed(2)}</td>
                      <td>
                        {editingId === pos.id ? (
                          <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <input 
                                type="number" 
                                placeholder="TP Price" 
                                value={tpInput} 
                                onChange={(e) => setTpInput(e.target.value)}
                                style={{ width: '80px', padding: '2px 4px', fontSize: '11px', background: 'var(--bg-panel-hover)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                              />
                              {calculateExpectedPnL(pos, tpInput) !== null && (
                                <span style={{ fontSize: '9px', color: calculateExpectedPnL(pos, tpInput)! >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', marginTop: '2px' }}>
                                  Est PnL: ${calculateExpectedPnL(pos, tpInput)!.toFixed(2)}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <input 
                                type="number" 
                                placeholder="SL Price" 
                                value={slInput} 
                                onChange={(e) => setSlInput(e.target.value)}
                                style={{ width: '80px', padding: '2px 4px', fontSize: '11px', background: 'var(--bg-panel-hover)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                              />
                              {calculateExpectedPnL(pos, slInput) !== null && (
                                <span style={{ fontSize: '9px', color: calculateExpectedPnL(pos, slInput)! >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', marginTop: '2px' }}>
                                  Est PnL: ${calculateExpectedPnL(pos, slInput)!.toFixed(2)}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button style={{ flex: 1, fontSize: '10px', padding: '2px', background: 'var(--accent-blue)', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer' }} onClick={() => handleSave(pos.id)}>Save</button>
                              <button style={{ flex: 1, fontSize: '10px', padding: '2px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '2px', cursor: 'pointer' }} onClick={() => setEditingId(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              <div>TP: {pos.tpPrice ? `$${pos.tpPrice}` : '--'}</div>
                              <div>SL: {pos.slPrice ? `$${pos.slPrice}` : '--'}</div>
                            </div>
                            <button 
                              onClick={() => handleEditClick(pos)}
                              style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '2px 6px', fontSize: '10px', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </td>
                      <td className={isPositive ? 'positive' : 'negative'}>
                        {isPositive ? '+' : ''}{pnl.toFixed(2)} USDC
                      </td>
                      <td>
                        <button className="close-btn" onClick={() => closePosition(pos.id)}>
                          Close
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PositionsPanel;
