export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  category: 'Trading' | 'Volume' | 'Leverage' | 'Streaks' | 'Duels' | 'Liquidity' | 'Time';
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Legendary';
  target: number;
  rewardPoints: number;
  evaluate: (store: any) => number;
}

const generateQuests = (): QuestDefinition[] => {
  const quests: QuestDefinition[] = [];
  let idCounter = 1;

  const add = (q: Omit<QuestDefinition, 'id'>) => {
    quests.push({ ...q, id: `quest_${idCounter++}` });
  };

  // ── 1. Volume Quests (20) ──────────────────────────────────────────────────
  const volTiers = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2500000, 5000000, 10000000, 25000000, 50000000, 100000000, 500000000];
  volTiers.forEach(v => add({
    title: `Volume ${v >= 1000000 ? 'Whale' : v >= 100000 ? 'Shark' : 'Trader'} ${v >= 1000000 ? v/1000000+'M' : v/1000+'k'}`,
    description: `Reach $${v.toLocaleString()} in total trading volume.`,
    category: 'Volume',
    difficulty: v < 10000 ? 'Easy' : v < 500000 ? 'Medium' : v < 10000000 ? 'Hard' : 'Legendary',
    target: v,
    rewardPoints: v >= 1000000 ? Math.floor(v / 50) : Math.floor(v / 10),
    evaluate: (s) => Math.min(s.volume || 0, v)
  }));

  // ── 2. Trade Counts (15) ───────────────────────────────────────────────────
  const tradeTiers = [1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000];
  tradeTiers.forEach(t => add({
    title: t === 1 ? 'First Blood' : `Trade Veteran (${t})`,
    description: `Complete ${t} total trades.`,
    category: 'Trading',
    difficulty: t <= 25 ? 'Easy' : t <= 150 ? 'Medium' : t <= 500 ? 'Hard' : 'Legendary',
    target: t,
    rewardPoints: t * 50,
    evaluate: (s) => Math.min((s.tradeHistory || []).length, t)
  }));

  // ── 3. Long/Short Specific (10) ────────────────────────────────────────────
  [5, 10, 25, 50, 100].forEach(t => {
    add({
      title: `The Big Short (${t})`,
      description: `Execute ${t} Short trades.`,
      category: 'Trading',
      difficulty: t <= 10 ? 'Easy' : t <= 50 ? 'Medium' : 'Hard',
      target: t,
      rewardPoints: t * 60,
      evaluate: (s) => Math.min((s.tradeHistory || []).filter((tr: any) => tr.type === 'Short').length, t)
    });
    add({
      title: `Perma Bull (${t})`,
      description: `Execute ${t} Long trades.`,
      category: 'Trading',
      difficulty: t <= 10 ? 'Easy' : t <= 50 ? 'Medium' : 'Hard',
      target: t,
      rewardPoints: t * 60,
      evaluate: (s) => Math.min((s.tradeHistory || []).filter((tr: any) => tr.type === 'Long').length, t)
    });
  });

  // ── 4. Leverage Plays (15) ─────────────────────────────────────────────────
  [2, 5, 10, 20, 25, 50, 75, 100].forEach(lev => {
    add({
      title: `Degen Mode: ${lev}x`,
      description: `Place a trade using at least ${lev}x leverage.`,
      category: 'Leverage',
      difficulty: lev <= 10 ? 'Easy' : lev <= 50 ? 'Medium' : 'Hard',
      target: 1,
      rewardPoints: lev * 15,
      evaluate: (s) => (s.tradeHistory || []).some((tr: any) => tr.leverage >= lev) ? 1 : 0
    });
    if (lev >= 10) {
      add({
        title: `Calculated Degen: ${lev}x`,
        description: `Close a PROFITABLE trade that used at least ${lev}x leverage.`,
        category: 'Leverage',
        difficulty: lev <= 25 ? 'Medium' : lev < 100 ? 'Hard' : 'Legendary',
        target: 1,
        rewardPoints: lev * 30,
        evaluate: (s) => (s.tradeHistory || []).some((tr: any) => tr.leverage >= lev && tr.pnl > 0) ? 1 : 0
      });
    }
  });

  // ── 5. Streaks (10) ────────────────────────────────────────────────────────
  [3, 5, 7, 10, 15, 20].forEach(s => {
    add({
      title: `Hot Streak (${s})`,
      description: `Win ${s} trades in a row (no losses in between).`,
      category: 'Streaks',
      difficulty: s <= 5 ? 'Medium' : s >= 15 ? 'Legendary' : 'Hard',
      target: s,
      rewardPoints: s * 250,
      evaluate: (sStore) => {
        let max = 0, cur = 0;
        (sStore.tradeHistory || []).forEach((tr: any) => {
          if (tr.pnl > 0) cur++; else cur = 0;
          if (cur > max) max = cur;
        });
        return Math.min(max, s);
      }
    });
  });
  [3, 5, 10, 15].forEach(s => {
    add({
      title: `Bounce Back (${s})`,
      description: `Survive a loss streak of ${s} and keep trading.`,
      category: 'Streaks',
      difficulty: s <= 5 ? 'Easy' : 'Medium',
      target: s,
      rewardPoints: s * 100,
      evaluate: (sStore) => {
        let max = 0, cur = 0;
        (sStore.tradeHistory || []).forEach((tr: any) => {
          if (tr.pnl < 0) cur++; else cur = 0;
          if (cur > max) max = cur;
        });
        return Math.min(max, s);
      }
    });
  });

  // ── 6. ROI Moonshots (10) ──────────────────────────────────────────────────
  [25, 50, 100, 200, 300, 400, 500, 750, 1000, 2000].forEach(r => {
    add({
      title: `Moonshot: ${r}% ROI`,
      description: `Achieve at least ${r}% ROI on a single trade.`,
      category: 'Streaks',
      difficulty: r <= 100 ? 'Medium' : r >= 500 ? 'Legendary' : 'Hard',
      target: 1,
      rewardPoints: r * 8,
      evaluate: (s) => (s.tradeHistory || []).some((tr: any) => (tr.pnl / tr.margin) * 100 >= r) ? 1 : 0
    });
  });

  // ── 7. Duels (10) ──────────────────────────────────────────────────────────
  [1, 3, 5, 10, 15, 25, 50, 75, 100, 250].forEach(d => {
    add({
      title: `Gladiator (${d})`,
      description: `Participate in ${d} 1VS1 Trading Duels today.`,
      category: 'Duels',
      difficulty: d <= 5 ? 'Easy' : d <= 25 ? 'Medium' : d <= 100 ? 'Hard' : 'Legendary',
      target: d,
      rewardPoints: d * 150,
      evaluate: (s) => Math.min(s.dailyDuelsCount || 0, d)
    });
  });

  // ── 8. Hold Times (5) ──────────────────────────────────────────────────────
  // Diamond Hands (holding trades for a certain duration)
  const timeTiers = [
    { m: 5, lbl: '5 Mins', diff: 'Easy' },
    { m: 15, lbl: '15 Mins', diff: 'Medium' },
    { m: 60, lbl: '1 Hour', diff: 'Hard' },
    { m: 240, lbl: '4 Hours', diff: 'Hard' },
    { m: 1440, lbl: '24 Hours', diff: 'Legendary' },
  ];
  timeTiers.forEach(t => {
    add({
      title: `Diamond Hands: ${t.lbl}`,
      description: `Hold a single profitable trade for at least ${t.lbl}.`,
      category: 'Time',
      difficulty: t.diff as any,
      target: 1,
      rewardPoints: t.m * 20,
      evaluate: (s) => {
        return (s.tradeHistory || []).some((tr: any) => {
          if (tr.pnl <= 0) return false;
          if (!tr.openTime || !tr.closeTime) return false;
          const mins = (tr.closeTime - tr.openTime) / (1000 * 60);
          return mins >= t.m;
        }) ? 1 : 0;
      }
    });
  });

  // ── 9. Liquidity Quests (5) ────────────────────────────────────────────────
  [100, 500, 1000, 5000, 10000].forEach(l => {
    add({
      title: `Pool Provider ($${l})`,
      description: `Deposit at least $${l.toLocaleString()} into any Liquidity Pool.`,
      category: 'Liquidity',
      difficulty: l <= 500 ? 'Easy' : l <= 5000 ? 'Medium' : 'Hard',
      target: l,
      rewardPoints: l,
      evaluate: (s) => {
        const maxDep = (s.liquidityHistory || []).reduce((max: number, record: any) => {
          if (record.type === 'deposit' && record.amount > max) return record.amount;
          return max;
        }, 0);
        return Math.min(maxDep, l);
      }
    });
  });

  return quests;
};

export const ALL_QUESTS = generateQuests();
