import React, { useState, useEffect } from 'react';

const generateMockData = (type: 'buy' | 'sell', basePrice: number, count: number) => {
  return Array.from({ length: count }).map((_, i) => {
    const price = type === 'sell' 
      ? basePrice + (count - i) * 0.05 
      : basePrice - (i + 1) * 0.05;
    const size = Math.random() * 1000 + 100;
    return { price, size, total: 0 }; // total calculated later
  });
};

const OrderBook: React.FC = () => {
  const [sells, setSells] = useState<any[]>([]);
  const [buys, setBuys] = useState<any[]>([]);

  useEffect(() => {
    const basePrice = 1.24;
    let mockSells = generateMockData('sell', basePrice, 12);
    let mockBuys = generateMockData('buy', basePrice, 12);

    // Calculate totals
    let sellTotal = 0;
    mockSells = mockSells.reverse().map(item => {
      sellTotal += item.size;
      return { ...item, total: sellTotal };
    }).reverse();

    let buyTotal = 0;
    mockBuys = mockBuys.map(item => {
      buyTotal += item.size;
      return { ...item, total: buyTotal };
    });

    setSells(mockSells);
    setBuys(mockBuys);
  }, []);

  const maxTotal = Math.max(
    sells[0]?.total || 0,
    buys[buys.length - 1]?.total || 0
  );

  return (
    <div className="orderbook">
      <div className="ob-header">Order Book</div>
      <div className="ob-labels">
        <span>Price (USDC)</span>
        <span>Size (ARC)</span>
        <span>Total</span>
      </div>

      <div className="ob-rows">
        {sells.map((sell, i) => (
          <div key={i} className="ob-row sell">
            <div className="depth-bar" style={{ width: `${(sell.total / maxTotal) * 100}%` }} />
            <span className="ob-price">{sell.price.toFixed(3)}</span>
            <span className="ob-size">{sell.size.toFixed(1)}</span>
            <span className="ob-total">{sell.total.toFixed(1)}</span>
          </div>
        ))}
      </div>

      <div className="ob-spread">
        $1.24 <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>(Spread 0.05)</span>
      </div>

      <div className="ob-rows">
        {buys.map((buy, i) => (
          <div key={i} className="ob-row buy">
            <div className="depth-bar" style={{ width: `${(buy.total / maxTotal) * 100}%` }} />
            <span className="ob-price">{buy.price.toFixed(3)}</span>
            <span className="ob-size">{buy.size.toFixed(1)}</span>
            <span className="ob-total">{buy.total.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderBook;
