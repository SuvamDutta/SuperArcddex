import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';

interface Coin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
}

const MarketSelector: React.FC = () => {
  const { activeMarket, setActiveMarket } = useStore();
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopCoins = async () => {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false'
        );
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        // Filter out stablecoins like tether/usdc if desired, or just map top 10
        const filtered = data.filter((c: Coin) => c.symbol !== 'usdt' && c.symbol !== 'usdc');
        setCoins(filtered);
      } catch (err) {
        console.error('Error fetching CoinGecko data:', err);
        // Fallback mock data if API limits hit
        setCoins([
          { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 65000, price_change_percentage_24h: 2.5 },
          { id: 'ethereum', symbol: 'eth', name: 'Ethereum', current_price: 3500, price_change_percentage_24h: 1.2 },
          { id: 'solana', symbol: 'sol', name: 'Solana', current_price: 150, price_change_percentage_24h: 5.4 }
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchTopCoins();
  }, []);

  if (loading) return <div style={{ padding: '16px' }}>Loading markets...</div>;

  return (
    <div className="market-selector">
      {coins.map((coin) => {
        const marketSymbol = `${coin.symbol.toUpperCase()}USDT`;
        const change = coin.price_change_percentage_24h || 0;
        const price = coin.current_price || 0;
        const isPositive = change >= 0;
        
        return (
          <div 
            key={coin.id} 
            className={`market-item ${activeMarket === marketSymbol ? 'active' : ''}`}
            onClick={() => setActiveMarket(marketSymbol)}
          >
            <span className="m-symbol">{coin.symbol.toUpperCase()}</span>
            <span className="m-price">${price.toLocaleString()}</span>
            <span className={`m-change ${isPositive ? 'positive' : 'negative'}`}>
              {isPositive ? '+' : ''}{change.toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default MarketSelector;
