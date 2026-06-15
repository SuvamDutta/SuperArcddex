import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BrowserProvider, parseEther } from 'ethers';

export interface Position {
  id: string;
  market: string;
  type: 'Long' | 'Short';
  margin: number;
  size: number;
  leverage: number;
  entryPrice: number;
  liqPrice: number;
  tpPrice?: number;
  slPrice?: number;
  openTime: number;
}

export interface TradeRecord {
  id: string;
  market: string;
  type: 'Long' | 'Short';
  margin: number;
  size: number;
  leverage: number;
  entryPrice: number;
  closePrice: number;
  pnl: number;
  openTime: number;
  closeTime: number;
  isLiquidated: boolean;
}

export interface LiquidityRecord {
  id: string;
  type: 'deposit' | 'withdraw';
  pool: string;
  asset: string;
  amount: number;
  timestamp: number;
}

export interface LiquidityPosition {
  pool: string;
  asset: string;
  color: string;
  deposited: number;
  addedAt: number;
}

interface WalletData {
  usdcBalance: number;
  positions: Position[];
  balanceHistory: { time: number; value: number }[];
  volume: number;
  realizedProfit: number;
  roi: number;
  points: number;
  tradeHistory: TradeRecord[];
  liquidityHistory: LiquidityRecord[];
  ethBalance: number;
  dailyDuelsCount: number;
  lastDuelDate: string;
  tokenBalances: Record<string, number>;
  questProgress: Record<string, boolean>;
}

interface StoreState {
  address: string | null;
  chainId: number | null;
  activeMarket: string;
  usdcBalance: number;
  points: number;
  volume: number;
  realizedProfit: number;
  roi: number;
  balanceHistory: { time: number; value: number }[];
  provider: any | null;
  positions: Position[];
  currentPrices: Record<string, number>;
  tradeHistory: TradeRecord[];
  liquidityPositions: LiquidityPosition[];
  liquidityHistory: LiquidityRecord[];
  walletsData: Record<string, WalletData>;
  ethBalance: number;
  dailyDuelsCount: number;
  lastDuelDate: string;
  questProgress: Record<string, boolean>;

  setActiveMarket: (market: string) => void;
  setCurrentPrice: (market: string, price: number) => void;
  addPoints: (amount: number) => void;
  deductPoints: (amount: number) => void;
  claimQuest: (questId: string, pointsAmount: number) => void;
  deductUSDC: (amount: number) => void;
  incrementDuelCount: () => void;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  checkNetwork: () => Promise<void>;
  depositUSDC: () => Promise<void>;
  openPosition: (type: 'Long' | 'Short', margin: number, leverage: number) => Promise<void>;
  closePosition: (id: string) => void;
  updatePositionTPSL: (id: string, tpPrice?: number, slPrice?: number) => void;
  addLiquidity: (pool: string, asset: string, color: string, amount: number) => void;
  removeLiquidity: (pool: string, amount: number) => void;
  tokenBalances: Record<string, number>;
  transferToken: (token: string, amount: number, toAddress: string, feeEth: number) => void;
  swapToken: (fromToken: string, toToken: string, fromAmount: number, toAmount: number, feeEth: number) => void;
}

const updateWalletData = (state: any) => {
  const addr = state.address;
  if (!addr) return {};

  // Always keep tokenBalances.USDC and tokenBalances.ETH in sync with their dedicated fields
  const syncedTokenBalances = {
    ...(state.tokenBalances || DEFAULT_WALLET_DATA.tokenBalances),
    USDC: state.usdcBalance ?? (state.tokenBalances?.USDC ?? 0),
    ETH: state.ethBalance ?? (state.tokenBalances?.ETH ?? 0),
  };

  return {
    tokenBalances: syncedTokenBalances,
    walletsData: {
      ...(state.walletsData || {}),
      [addr]: {
        usdcBalance: state.usdcBalance,
        positions: state.positions,
        balanceHistory: state.balanceHistory,
        volume: state.volume,
        realizedProfit: state.realizedProfit,
        roi: state.roi,
        points: state.points,
        tradeHistory: state.tradeHistory || [],
        liquidityPositions: state.liquidityPositions || [],
        liquidityHistory: state.liquidityHistory || [],
        ethBalance: state.ethBalance || 0,
        dailyDuelsCount: state.dailyDuelsCount || 0,
        lastDuelDate: state.lastDuelDate || '',
        questProgress: state.questProgress || {},
        tokenBalances: syncedTokenBalances,
      }
    }
  };
};

const DEFAULT_WALLET_DATA: WalletData = {
  usdcBalance: 10000,
  positions: [],
  balanceHistory: [{ time: Date.now(), value: 10000 }],
  volume: 0,
  realizedProfit: 0,
  roi: 0,
  points: 0,
  tradeHistory: [],
  liquidityPositions: [],
  liquidityHistory: [],
  ethBalance: 2.45,
  dailyDuelsCount: 0,
  lastDuelDate: '',
  tokenBalances: {
    USDC: 10000,
    USDT: 5000,
    ETH: 2.45,
    BTC: 0.085,
    ARC: 1500,
    BNB: 3.2
  },
  questProgress: {},
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      address: null,
      chainId: null,
      activeMarket: 'BTCUSDT',
      usdcBalance: 0,
      points: 0,
      volume: 0,
      realizedProfit: 0,
      roi: 0,
      balanceHistory: [],
      provider: null,
      ethBalance: 0,
      dailyDuelsCount: 0,
      lastDuelDate: '',
      tokenBalances: {
        USDC: 10000,
        USDT: 5000,
        ETH: 2.45,
        BTC: 0.085,
        ARC: 1500,
        BNB: 3.2
      },
      questProgress: {},
      positions: [],
      currentPrices: {},
      tradeHistory: [],
      liquidityPositions: [],
      liquidityHistory: [],
      walletsData: {},

      setActiveMarket: (market: string) => set({ activeMarket: market }),

      setCurrentPrice: (market: string, price: number) => set((state) => {
        const newPrices = { ...state.currentPrices, [market]: price };
        let newPositions = [...state.positions];
        let balanceChange = 0;
        let newVolume = state.volume;
        let newRealizedProfit = state.realizedProfit;
        let newTradeHistory = [...(state.tradeHistory || [])];

        for (let i = newPositions.length - 1; i >= 0; i--) {
          const pos = newPositions[i];
          if (pos.market !== market) continue;

          let shouldClose = false;
          let isLiquidated = false;

          if (pos.type === 'Long') {
            if (pos.tpPrice && price >= pos.tpPrice) shouldClose = true;
            if (pos.slPrice && price <= pos.slPrice) shouldClose = true;
            if (price <= pos.liqPrice) { shouldClose = true; isLiquidated = true; }
          } else {
            if (pos.tpPrice && price <= pos.tpPrice) shouldClose = true;
            if (pos.slPrice && price >= pos.slPrice) shouldClose = true;
            if (price >= pos.liqPrice) { shouldClose = true; isLiquidated = true; }
          }

          if (shouldClose) {
            const priceDiff = price - pos.entryPrice;
            const pnlPercentage = priceDiff / pos.entryPrice;
            let pnl = pos.type === 'Long' ? pos.size * pnlPercentage : pos.size * -pnlPercentage;

            if (isLiquidated) {
              pnl = -pos.margin;
            }

            const returnedAmount = Math.max(0, pos.margin + pnl);
            balanceChange += returnedAmount;
            newVolume += pos.size;
            newRealizedProfit += pnl;

            newTradeHistory.push({
              id: pos.id,
              market: pos.market,
              type: pos.type,
              margin: pos.margin,
              size: pos.size,
              leverage: pos.leverage,
              entryPrice: pos.entryPrice,
              closePrice: price,
              pnl: pnl,
              closeTime: Date.now(),
              isLiquidated
            });

            newPositions.splice(i, 1);

            setTimeout(() => {
              if (isLiquidated) alert(`Position Liquidated! Market: ${pos.market}`);
              else alert(`Position Auto-Closed (TP/SL Hit)! Market: ${pos.market}, PnL: ${pnl.toFixed(2)}`);
            }, 100);
          }
        }

        const newRoi = newVolume > 0 ? (newRealizedProfit / newVolume) * 100 : 0;
        let newPoints = state.points;
        if (newRoi > 0 && newRealizedProfit > 0) {
          newPoints = Math.floor((newRealizedProfit / newRoi) * 10);
        }

        const newBalance = state.usdcBalance + balanceChange;
        const currentHistory = state.balanceHistory || [];
        const newBalanceHistory = balanceChange !== 0
          ? [...currentHistory, { time: Date.now(), value: newBalance }]
          : currentHistory;

        const newState = {
          currentPrices: newPrices,
          positions: newPositions,
          usdcBalance: newBalance,
          balanceHistory: newBalanceHistory,
          volume: newVolume,
          realizedProfit: newRealizedProfit,
          roi: newRoi,
          points: newPoints,
          tradeHistory: newTradeHistory
        };

        return {
          ...newState,
          ...updateWalletData({ ...state, ...newState })
        };
      }),

      connectWallet: async () => {
        if (typeof window !== 'undefined' && window.ethereum) {
          try {
            const provider = new BrowserProvider(window.ethereum);
            const accounts = await provider.send('eth_requestAccounts', []);
            const network = await provider.getNetwork();
            const addr = accounts[0];

            const state = get();
            const walletsData = state.walletsData || {};
            const walletData: WalletData = walletsData[addr] || { ...DEFAULT_WALLET_DATA, balanceHistory: [{ time: Date.now(), value: 10000 }] };

            // Fetch exact ETH balance
            const ethBalRaw = await provider.getBalance(addr);
            const ethBalanceStr = import('ethers').then(ethers => ethers.formatEther(ethBalRaw));
            // Wait, we already have parseEther imported. We can import formatEther at the top.
            // Let me modify the top imports too if formatEther is missing.
            // Actually I'll use ethers.formatEther by importing it or using BigInt math.
            // 1 ETH = 10^18 wei.
            const ethBalance = Number(ethBalRaw) / 1e18;

            const baseTokenBalances = walletData.tokenBalances || DEFAULT_WALLET_DATA.tokenBalances;
            const syncedTokenBalances = {
              ...baseTokenBalances,
              USDC: walletData.usdcBalance,
              ETH: ethBalance,
            };

            set({
              address: addr,
              chainId: Number(network.chainId),
              provider,
              usdcBalance: walletData.usdcBalance,
              positions: walletData.positions,
              balanceHistory: walletData.balanceHistory,
              volume: walletData.volume,
              realizedProfit: walletData.realizedProfit,
              roi: walletData.roi,
              points: walletData.points,
              tradeHistory: walletData.tradeHistory,
              liquidityPositions: walletData.liquidityPositions || [],
              liquidityHistory: walletData.liquidityHistory || [],
              ethBalance,
              dailyDuelsCount: walletData.dailyDuelsCount || 0,
              lastDuelDate: walletData.lastDuelDate || '',
              tokenBalances: syncedTokenBalances,
              walletsData: {
                ...walletsData,
                [addr]: { ...walletData, ethBalance, tokenBalances: syncedTokenBalances }
              }
            });

            window.ethereum.on('chainChanged', (chainId: string) => {
              set({ chainId: parseInt(chainId, 16) });
            });
            window.ethereum.on('accountsChanged', async (accounts: string[]) => {
              const newAddr = accounts[0];
              if (newAddr) {
                const innerState = get();
                const innerWalletsData = innerState.walletsData || {};
                const innerWalletData: WalletData = innerWalletsData[newAddr] || { ...DEFAULT_WALLET_DATA, balanceHistory: [{ time: Date.now(), value: 10000 }] };
                
                let newEthBal = innerWalletData.ethBalance || 0;
                if (innerState.provider) {
                  try {
                    const bal = await innerState.provider.getBalance(newAddr);
                    newEthBal = Number(bal) / 1e18;
                  } catch (e) { console.error('Error fetching balance:', e); }
                }

                set({
                  address: newAddr,
                  usdcBalance: innerWalletData.usdcBalance,
                  positions: innerWalletData.positions,
                  balanceHistory: innerWalletData.balanceHistory,
                  volume: innerWalletData.volume,
                  realizedProfit: innerWalletData.realizedProfit,
                  roi: innerWalletData.roi,
                  points: innerWalletData.points,
                  tradeHistory: innerWalletData.tradeHistory,
                  liquidityPositions: innerWalletData.liquidityPositions || [],
                  liquidityHistory: innerWalletData.liquidityHistory || [],
                  ethBalance: newEthBal,
                  dailyDuelsCount: innerWalletData.dailyDuelsCount || 0,
                  lastDuelDate: innerWalletData.lastDuelDate || '',
                  tokenBalances: innerWalletData.tokenBalances || DEFAULT_WALLET_DATA.tokenBalances,
                  walletsData: {
                    ...innerWalletsData,
                    [newAddr]: { ...innerWalletData, ethBalance: newEthBal }
                  }
                });
              } else {
                get().disconnectWallet();
              }
            });
          } catch (error: any) {
            console.error('Failed to connect wallet:', error);
            if (error.code === 4001) {
              alert('You rejected the connection request.');
            } else {
              alert('Failed to connect wallet. Please try again.');
            }
          }
        } else {
          alert('MetaMask is not installed. Please install it to connect your wallet!');
        }
      },

      disconnectWallet: () => {
        set({
          address: null,
          chainId: null,
          provider: null,
          usdcBalance: 0,
          positions: [],
          balanceHistory: [],
          volume: 0,
          realizedProfit: 0,
          roi: 0,
          points: 0,
          tradeHistory: [],
          liquidityPositions: [],
          liquidityHistory: [],
          ethBalance: 0,
          dailyDuelsCount: 0,
          lastDuelDate: '',
          tokenBalances: DEFAULT_WALLET_DATA.tokenBalances,
        });
      },

      checkNetwork: async () => {
        if (typeof window !== 'undefined' && window.ethereum) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x4CEF52' }],
            });
          } catch (switchError: any) {
            if (switchError.code === 4902) {
              try {
                await window.ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [
                    {
                      chainId: '0x4CEF52',
                      chainName: 'ARC Network Testnet',
                      rpcUrls: ['https://rpc.testnet.arc.network'],
                      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                      blockExplorerUrls: ['https://testnet.arcscan.app'],
                    },
                  ],
                });
              } catch (addError: any) {
                console.error('Failed to add ARC network:', addError);
                alert(`MetaMask failed to add the network: ${addError.message || 'Unknown error'}`);
              }
            } else if (switchError.code === 4001) {
              console.log('User rejected the switch network request');
            } else {
              console.error('Failed to switch ARC network:', switchError);
              alert(`MetaMask failed to switch network: ${switchError.message || 'Unknown error'}`);
            }
          }
        }
      },

      depositUSDC: async () => {
        const { provider, address } = get();
        if (!provider || !address) {
          alert('Please connect your wallet first');
          return;
        }
        try {
          const signer = await provider.getSigner();
          const vaultAddress = '0x000000000000000000000000000000000000dEaD';
          const tx = await signer.sendTransaction({
            to: vaultAddress,
            value: parseEther('0.001'),
          });
          alert(`Transaction submitted! Hash: ${tx.hash}\nWaiting for confirmation...`);
          await tx.wait();
          set((state) => {
            const newBalance = state.usdcBalance + 1000;
            const newState = {
              usdcBalance: newBalance,
              balanceHistory: [...(state.balanceHistory || []), { time: Date.now(), value: newBalance }]
            };
            return { ...newState, ...updateWalletData({ ...state, ...newState }) };
          });
          alert('Deposit successful! 1000 Mock USDC credited to your DEX balance.');
        } catch (error: any) {
          console.error('Deposit failed:', error);
          alert(`Deposit failed: ${error.shortMessage || error.message}`);
        }
      },

      openPosition: async (type, margin, leverage) => {
        const { provider, address, activeMarket, currentPrices, usdcBalance } = get();
        if (!provider || !address) {
          alert('Please connect your wallet first');
          return;
        }
        const entryPrice = currentPrices[activeMarket] || 0;
        if (entryPrice === 0) {
          alert('Market price not loaded yet. Please wait.');
          return;
        }
        if (margin > usdcBalance) {
          alert('Insufficient USDC balance.');
          return;
        }
        try {
          const signer = await provider.getSigner();
          const feeVaultAddress = '0x000000000000000000000000000000000000FEE5';
          const tx = await signer.sendTransaction({
            to: feeVaultAddress,
            value: parseEther('0.0005'),
          });
          await tx.wait();
          set((state) => {
            if (margin > state.usdcBalance) return state;
            const size = margin * leverage;
            const liqPrice = type === 'Long'
              ? entryPrice * (1 - (1 / leverage))
              : entryPrice * (1 + (1 / leverage));
            const newPos: Position = {
              id: Math.random().toString(36).substring(2, 9),
              market: activeMarket,
              type,
              margin,
              size,
              leverage,
              entryPrice,
              liqPrice,
              openTime: Date.now()
            };
            const newState = {
              usdcBalance: state.usdcBalance - margin,
              positions: [...state.positions, newPos],
            };
            return { ...newState, ...updateWalletData({ ...state, ...newState }) };
          });
        } catch (error: any) {
          console.error('Trading fee transaction failed:', error);
          alert(`Trade cancelled: ${error.shortMessage || error.message}`);
        }
      },

      closePosition: (id) => {
        set((state) => {
          const pos = state.positions.find(p => p.id === id);
          if (!pos) return state;
          const currentPrice = state.currentPrices[pos.market] || pos.entryPrice;
          const priceDiff = currentPrice - pos.entryPrice;
          const pnlPercentage = priceDiff / pos.entryPrice;
          let pnl = 0;
          if (pos.type === 'Long') {
            pnl = pos.size * pnlPercentage;
          } else {
            pnl = pos.size * -pnlPercentage;
          }
          const returnedAmount = pos.margin + pnl;
          const newVolume = state.volume + pos.size;
          const newRealizedProfit = state.realizedProfit + pnl;
          const newRoi = newVolume > 0 ? (newRealizedProfit / newVolume) * 100 : 0;
          let newPoints = state.points;
          if (newRoi > 0 && newRealizedProfit > 0) {
            newPoints = Math.floor((newRealizedProfit / newRoi) * 10);
          }
          const newBalance = state.usdcBalance + Math.max(0, returnedAmount);
          const newTradeHistory = [...(state.tradeHistory || [])];
          newTradeHistory.push({
            id: pos.id,
            market: pos.market,
            type: pos.type,
            margin: pos.margin,
            size: pos.size,
            leverage: pos.leverage,
            entryPrice: pos.entryPrice,
            closePrice: currentPrice,
            pnl: pnl,
            openTime: pos.openTime || Date.now(),
            closeTime: Date.now(),
            isLiquidated: false
          });
          const newState = {
            positions: state.positions.filter(p => p.id !== id),
            usdcBalance: newBalance,
            balanceHistory: [...(state.balanceHistory || []), { time: Date.now(), value: newBalance }],
            volume: newVolume,
            realizedProfit: newRealizedProfit,
            roi: newRoi,
            points: newPoints,
            tradeHistory: newTradeHistory
          };
          return { ...newState, ...updateWalletData({ ...state, ...newState }) };
        });
      },

      updatePositionTPSL: (id, tpPrice, slPrice) => {
        set((state) => {
          const newState = {
            positions: state.positions.map(p =>
              p.id === id ? { ...p, tpPrice, slPrice } : p
            )
          };
          return { ...newState, ...updateWalletData({ ...state, ...newState }) };
        });
      },

      claimQuest: (questId: string, pointsAmount: number) => {
        set((state) => {
          if (state.questProgress[questId]) return state; // Already claimed
          
          const newState = {
            points: state.points + pointsAmount,
            questProgress: { ...state.questProgress, [questId]: true }
          };
          
          return { ...newState, ...updateWalletData({ ...state, ...newState }) };
        });
      },

      // ── Liquidity actions ──────────────────────────────────────────────────────
      addLiquidity: (pool: string, asset: string, color: string, amount: number) => {
        set((state) => {
          if (!state.address) return state;
          if (amount <= 0 || amount > state.usdcBalance) return state;

          const newBalance = state.usdcBalance - amount;

          // Merge into existing position for that pool or create new
          const existingIdx = state.liquidityPositions.findIndex(p => p.pool === pool);
          let newLiqPositions = [...state.liquidityPositions];
          if (existingIdx >= 0) {
            newLiqPositions[existingIdx] = {
              ...newLiqPositions[existingIdx],
              deposited: newLiqPositions[existingIdx].deposited + amount,
            };
          } else {
            newLiqPositions.push({ pool, asset, color, deposited: amount, addedAt: Date.now() });
          }

          const newRecord: LiquidityRecord = {
            id: Math.random().toString(36).substring(2, 9),
            type: 'deposit',
            pool,
            asset,
            amount,
            timestamp: Date.now(),
          };

          const newState = {
            usdcBalance: newBalance,
            liquidityPositions: newLiqPositions,
            liquidityHistory: [newRecord, ...(state.liquidityHistory || [])],
            balanceHistory: [...(state.balanceHistory || []), { time: Date.now(), value: newBalance }],
          };

          return { ...newState, ...updateWalletData({ ...state, ...newState }) };
        });
      },

      removeLiquidity: (pool: string, amount: number) => {
        set((state) => {
          if (!state.address) return state;
          const pos = state.liquidityPositions.find(p => p.pool === pool);
          if (!pos || amount <= 0 || amount > pos.deposited) return state;

          const newBalance = state.usdcBalance + amount;

          let newLiqPositions = state.liquidityPositions
            .map(p => p.pool === pool ? { ...p, deposited: p.deposited - amount } : p)
            .filter(p => p.deposited > 0);

          const newRecord: LiquidityRecord = {
            id: Math.random().toString(36).substring(2, 9),
            type: 'withdraw',
            pool,
            asset: pos.asset,
            amount,
            timestamp: Date.now(),
          };

          const newState = {
            usdcBalance: newBalance,
            liquidityPositions: newLiqPositions,
            liquidityHistory: [newRecord, ...(state.liquidityHistory || [])],
            balanceHistory: [...(state.balanceHistory || []), { time: Date.now(), value: newBalance }],
          };

          return { ...newState, ...updateWalletData({ ...state, ...newState }) };
        });
      },

      addPoints: (amount: number) => {
        set((state) => {
          const newState = { points: state.points + amount };
          return { ...newState, ...updateWalletData({ ...state, ...newState }) };
        });
      },

      deductPoints: (amount: number) => {
        set((state) => {
          const newState = { points: Math.max(0, state.points - amount) };
          return { ...newState, ...updateWalletData({ ...state, ...newState }) };
        });
      },

      deductUSDC: (amount: number) => {
        set((state) => {
          const newUsdcBalance = state.usdcBalance - amount;
          const newTokenBalances = {
            ...(state.tokenBalances || DEFAULT_WALLET_DATA.tokenBalances),
            USDC: newUsdcBalance,
          };
          const newState = { usdcBalance: newUsdcBalance, tokenBalances: newTokenBalances };
          return { ...newState, ...updateWalletData({ ...state, ...newState }) };
        });
      },

      incrementDuelCount: () => {
        set((state) => {
          const today = new Date().toISOString().split('T')[0];
          const isNewDay = state.lastDuelDate !== today;
          const newCount = isNewDay ? 1 : state.dailyDuelsCount + 1;
          const newState = {
            dailyDuelsCount: newCount,
            lastDuelDate: today
          };
          return { ...newState, ...updateWalletData({ ...state, ...newState }) };
        });
      },

      transferToken: (token: string, amount: number, toAddress: string, feeEth: number) => {
        set((state) => {
          if (!state.address) return state;
          
          const currentBals = { ...(state.tokenBalances || DEFAULT_WALLET_DATA.tokenBalances) };
          
          if ((currentBals[token] || 0) < amount) return state; // Insufficient
          
          currentBals[token] -= amount;
          currentBals['ETH'] = (currentBals['ETH'] || 0) - feeEth;
          
          const targetWallet = state.walletsData?.[toAddress] || { ...DEFAULT_WALLET_DATA, tokenBalances: { ...DEFAULT_WALLET_DATA.tokenBalances } };
          const targetBals = { ...targetWallet.tokenBalances };
          targetBals[token] = (targetBals[token] || 0) + amount;

          // Sync backwards to usdcBalance and ethBalance if necessary
          const usdcBalance = currentBals['USDC'];
          const ethBalance = currentBals['ETH'];

          const newState = {
            tokenBalances: currentBals,
            usdcBalance,
            ethBalance
          };
          
          const updatedWalletsData = {
            ...state.walletsData,
            [state.address]: {
              ...state.walletsData?.[state.address],
              ...newState
            },
            [toAddress]: {
              ...targetWallet,
              tokenBalances: targetBals,
              usdcBalance: targetBals['USDC'],
              ethBalance: targetBals['ETH']
            }
          };

          return { ...newState, walletsData: updatedWalletsData };
        });
      },

      swapToken: (fromToken: string, toToken: string, fromAmount: number, toAmount: number, feeEth: number) => {
        set((state) => {
          if (!state.address) return state;
          
          const currentBals = { ...(state.tokenBalances || DEFAULT_WALLET_DATA.tokenBalances) };
          
          if ((currentBals[fromToken] || 0) < fromAmount) return state;
          
          currentBals[fromToken] -= fromAmount;
          currentBals[toToken] = (currentBals[toToken] || 0) + toAmount;
          currentBals['ETH'] = (currentBals['ETH'] || 0) - feeEth;

          const usdcBalance = currentBals['USDC'];
          const ethBalance = currentBals['ETH'];

          const newState = {
            tokenBalances: currentBals,
            usdcBalance,
            ethBalance
          };

          return { ...newState, ...updateWalletData({ ...state, ...newState }) };
        });
      },
    }),
    {
      name: 'arcdex-storage',
      partialize: (state) => ({
        walletsData: state.walletsData || {},
        positions: state.positions,
        usdcBalance: state.usdcBalance,
        ethBalance: state.ethBalance,
        tokenBalances: state.tokenBalances,
        volume: state.volume,
        realizedProfit: state.realizedProfit,
        roi: state.roi,
        points: state.points,
        balanceHistory: state.balanceHistory || [],
        tradeHistory: state.tradeHistory || [],
        liquidityPositions: state.liquidityPositions || [],
        liquidityHistory: state.liquidityHistory || [],
      })
    }
  )
);
