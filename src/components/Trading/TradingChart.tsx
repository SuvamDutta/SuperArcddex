import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { useStore } from '../../store/useStore';

const TradingChart: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const priceLinesRef = useRef<any[]>([]);
  const { activeMarket, positions } = useStore();
  const [currentPrice, setCurrentPrice] = useState<string>('0.00');
  const [priceChange, setPriceChange] = useState<string>('+0.00%');
  const [isPositive, setIsPositive] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid' as any, color: 'transparent' },
        textColor: '#848e9c',
      },
      grid: {
        vertLines: { color: 'rgba(43, 49, 57, 0.5)' },
        horzLines: { color: 'rgba(43, 49, 57, 0.5)' },
      },
      width: chartContainerRef.current.clientWidth || 400,
      height: chartContainerRef.current.clientHeight || 300,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderVisible: false,
      }
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81',
      downColor: '#f6465d',
      borderVisible: false,
      wickUpColor: '#0ecb81',
      wickDownColor: '#f6465d',
    });

    chartInstanceRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    let isMounted = true;
    let ws: WebSocket | null = null;
    let fallbackInterval: any = null;
    let wsTimeout: any = null;

    const getBasePrice = (market: string): number => {
      switch (market) {
        case 'BTCUSDT': return 65000;
        case 'ETHUSDT': return 3500;
        case 'SOLUSDT': return 150;
        case 'BNBUSDT': return 580;
        case 'XRPUSDT': return 0.50;
        default: return 100;
      }
    };

    const startLocalSimulation = (initialPrice: number, historicalData?: any[]) => {
      if (!isMounted) return;
      console.log('Starting local price simulation fallback for', activeMarket, 'starting at', initialPrice);
      
      let lastCandleTime = 0;
      let lastClosePrice = initialPrice;
      let currentMinuteCandle: any = null;

      if (historicalData && historicalData.length > 0) {
        lastCandleTime = historicalData[historicalData.length - 1].time;
        lastClosePrice = historicalData[historicalData.length - 1].close;
      } else {
        // Generate mock history
        const now = Math.floor(Date.now() / 1000);
        const start = now - 100 * 60;
        const mockHistory = [];
        let price = initialPrice;
        for (let i = 0; i < 100; i++) {
          const open = price;
          const pct = (Math.random() - 0.49) * 0.003; // small movements
          const close = open * (1 + pct);
          const high = Math.max(open, close) * (1 + Math.random() * 0.001);
          const low = Math.min(open, close) * (1 - Math.random() * 0.001);
          const t = start + i * 60;
          mockHistory.push({ time: t as any, open, high, low, close });
          price = close;
        }
        candlestickSeries.setData(mockHistory);
        lastCandleTime = start + 99 * 60;
        lastClosePrice = price;
        
        setCurrentPrice(price.toFixed(2));
        useStore.getState().setCurrentPrice(activeMarket, price);
      }

      // Start ticker interval
      fallbackInterval = setInterval(() => {
        if (!isMounted) return;

        // Fluctuates slightly
        const pct = (Math.random() - 0.5) * 0.001; // small volatility
        const newPrice = lastClosePrice * (1 + pct);

        const now = Math.floor(Date.now() / 1000);
        const minuteStart = now - (now % 60);

        let liveCandle;
        if (minuteStart > lastCandleTime) {
          // New candle
          currentMinuteCandle = {
            time: minuteStart as any,
            open: lastClosePrice,
            high: Math.max(lastClosePrice, newPrice),
            low: Math.min(lastClosePrice, newPrice),
            close: newPrice
          };
          liveCandle = currentMinuteCandle;
          lastCandleTime = minuteStart;
        } else {
          if (!currentMinuteCandle) {
            currentMinuteCandle = {
              time: minuteStart as any,
              open: lastClosePrice,
              high: Math.max(lastClosePrice, newPrice),
              low: Math.min(lastClosePrice, newPrice),
              close: newPrice
            };
          } else {
            currentMinuteCandle.high = Math.max(currentMinuteCandle.high, newPrice);
            currentMinuteCandle.low = Math.min(currentMinuteCandle.low, newPrice);
            currentMinuteCandle.close = newPrice;
          }
          liveCandle = currentMinuteCandle;
        }

        lastClosePrice = newPrice;
        candlestickSeries.update(liveCandle);

        setCurrentPrice(newPrice.toFixed(2));
        useStore.getState().setCurrentPrice(activeMarket, newPrice);
        
        // Calculate dynamic change
        const firstClose = historicalData && historicalData.length > 0 ? historicalData[0].close : initialPrice;
        const change = ((newPrice - firstClose) / firstClose) * 100;
        setIsPositive(change >= 0);
        setPriceChange(`${change >= 0 ? '+' : ''}${change.toFixed(2)}%`);

      }, 1000);
    };

    // Fetch Historical Binance Klines
    const fetchKlines = async () => {
      let wsConnected = false;
      let historicalData: any[] = [];
      let basePrice = getBasePrice(activeMarket);

      // Start a timeout: if we don't successfully establish ws and get a message within 2.5s, run simulation
      wsTimeout = setTimeout(() => {
        if (!wsConnected) {
          console.warn("Binance WebSocket stream connection timed out, starting simulation.");
          if (ws) {
            try { ws.close(); } catch(e){}
          }
          startLocalSimulation(basePrice, historicalData);
        }
      }, 2500);

      try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${activeMarket}&interval=1m&limit=100`);
        if (!res.ok) throw new Error('Binance API response error');
        const data = await res.json();
        
        if (!isMounted) return;

        let firstClose = 0;

        historicalData = data.map((d: any) => {
          const closePrice = parseFloat(d[4]);
          if (firstClose === 0) firstClose = closePrice;
          return {
            time: (d[0] / 1000) as any,
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: closePrice,
          };
        });

        candlestickSeries.setData(historicalData);

        if (historicalData.length > 0) {
          const latest = historicalData[historicalData.length - 1];
          const first = historicalData[0];
          
          setCurrentPrice(latest.close.toFixed(2));
          useStore.getState().setCurrentPrice(activeMarket, latest.close);
          basePrice = latest.close;
          
          const change = ((latest.close - first.close) / first.close) * 100;
          setIsPositive(change >= 0);
          setPriceChange(`${change >= 0 ? '+' : ''}${change.toFixed(2)}%`);
        }

        // Initialize Live WebSocket Stream
        ws = new WebSocket(`wss://stream.binance.com:9443/ws/${activeMarket.toLowerCase()}@kline_1m`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          if (!isMounted) return;
          // Clear timeout on first message
          if (!wsConnected) {
            wsConnected = true;
            clearTimeout(wsTimeout);
          }
          
          const message = JSON.parse(event.data);
          const kline = message.k;
          
          const liveCandle = {
            time: (kline.t / 1000) as any,
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c),
          };

          candlestickSeries.update(liveCandle);

          setCurrentPrice(liveCandle.close.toFixed(2));
          useStore.getState().setCurrentPrice(activeMarket, liveCandle.close);

          if (firstClose > 0) {
             const change = ((liveCandle.close - firstClose) / firstClose) * 100;
             setIsPositive(change >= 0);
             setPriceChange(`${change >= 0 ? '+' : ''}${change.toFixed(2)}%`);
          }
        };

        ws.onerror = (err) => {
          console.error("WebSocket error:", err);
          if (!wsConnected) {
            clearTimeout(wsTimeout);
            startLocalSimulation(basePrice, historicalData);
          }
        };

      } catch (err) {
        console.error('Failed to fetch klines for chart, starting simulation fallback', err);
        clearTimeout(wsTimeout);
        if (!wsConnected) {
          startLocalSimulation(basePrice, historicalData);
        }
      }
    };

    fetchKlines();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      chart.remove();
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (wsTimeout) {
        clearTimeout(wsTimeout);
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [activeMarket]);

  useEffect(() => {
    if (!candlestickSeriesRef.current) return;
    const series = candlestickSeriesRef.current;

    // Remove old lines
    priceLinesRef.current.forEach(line => {
      try { series.removePriceLine(line); } catch (e) {}
    });
    priceLinesRef.current = [];

    // Add new lines
    positions.filter(p => p.market === activeMarket).forEach(pos => {
      if (pos.tpPrice) {
        priceLinesRef.current.push(series.createPriceLine({
          price: pos.tpPrice,
          color: '#0ecb81',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'TP',
        }));
      }

      if (pos.slPrice) {
        priceLinesRef.current.push(series.createPriceLine({
          price: pos.slPrice,
          color: '#f6465d',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'SL',
        }));
      }

      if (pos.liqPrice) {
        priceLinesRef.current.push(series.createPriceLine({
          price: pos.liqPrice,
          color: '#ff9800',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'LIQ',
        }));
      }
    });
  }, [positions, activeMarket]);

  return (
    <div className="chart-wrapper">
      <div className="chart-header">
        <h2>{activeMarket}</h2>
        <span className={`price ${isPositive ? 'positive' : 'negative'}`}>${currentPrice}</span>
        <span className={`change ${isPositive ? 'positive' : 'negative'}`}>{priceChange}</span>
      </div>
      <div 
        ref={chartContainerRef} 
        style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }} 
      />
    </div>
  );
};

export default TradingChart;
