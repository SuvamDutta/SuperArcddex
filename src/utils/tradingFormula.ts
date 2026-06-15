import { TradeRecord } from '../store/useStore';

/**
 * SuperArc Dex Secret Trading Formula
 * -----------------------------------
 * This algorithmic formula determines a user's "Weekly Score" which is used to 
 * distribute the 100k points pool. It weights trades based on:
 * 
 * 1. PnL Multiplier: Positive PnL gives a base score, negative PnL penalizes lightly.
 * 2. ROI Factor: High ROI trades (relative to margin) get a bonus.
 * 3. Hold Time: Longer holds demonstrate strategy rather than just spamming high-leverage quick scalps.
 * 4. Win Consistency: High win rate multiplies the overall score.
 */

export const calculateWeeklyScore = (tradeHistory: TradeRecord[]): number => {
  if (!tradeHistory || tradeHistory.length === 0) return 0;

  let totalScore = 0;
  let wins = 0;

  tradeHistory.forEach((trade) => {
    // 1. PnL Multiplier
    // E.g. $50 PnL -> 50 points base. Losses deduct a portion but aren't entirely devastating to avoid discouraging trading.
    const pnlBase = trade.pnl > 0 ? trade.pnl : trade.pnl * 0.5;
    
    // 2. ROI Factor (Bonus for high ROI)
    // ROI = PnL / Margin. e.g. $50 PnL on $10 Margin = 5.0 (500% ROI). 
    // We cap the multiplier to avoid one lucky degen play dominating the entire pool.
    const roi = trade.pnl / trade.margin;
    let roiMultiplier = 1;
    if (roi > 0) {
      roiMultiplier = 1 + Math.min(roi, 5); // Max 5x bonus
    }

    // 3. Hold Time Factor
    // Trades held for longer (e.g. 1 hour+) get a strategic bonus. Scalps (< 1 min) get less weight.
    const holdTimeMinutes = (trade.closeTime - trade.openTime) / (1000 * 60);
    let holdFactor = 1;
    if (holdTimeMinutes > 60) holdFactor = 1.5;
    else if (holdTimeMinutes > 15) holdFactor = 1.2;
    else if (holdTimeMinutes < 1) holdFactor = 0.8; // Quick scalp penalty
    
    // Calculate trade's individual score
    if (trade.pnl > 0) {
      wins++;
      totalScore += pnlBase * roiMultiplier * holdFactor;
    } else {
      // For losses, just deduct the base loss (no ROI penalty multiplier)
      totalScore += pnlBase;
    }
  });

  // 4. Win Consistency Bonus
  // E.g. 80% win rate -> 1.8x multiplier. 40% win rate -> 0.8x multiplier.
  const winRate = wins / tradeHistory.length;
  let consistencyMultiplier = 1;
  if (winRate > 0.7) consistencyMultiplier = 1.5;
  else if (winRate > 0.5) consistencyMultiplier = 1.2;
  else if (winRate < 0.4) consistencyMultiplier = 0.8;

  const finalScore = totalScore * consistencyMultiplier;

  // Floor to 0 (don't show negative weekly scores)
  return Math.max(0, Math.floor(finalScore));
};
