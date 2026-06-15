import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Target, CheckCircle2, Trophy, Coins, Zap, Activity, Filter, Gift } from 'lucide-react';
import { ALL_QUESTS, QuestDefinition } from '../data/quests';

type CategoryFilter = 'All' | QuestDefinition['category'];

const QuestView: React.FC = () => {
  const store = useStore();
  const { address, questProgress, claimQuest } = store;

  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All');
  const [showCompleted, setShowCompleted] = useState(true);

  // Re-evaluate progress for all quests based on current store
  const evaluatedQuests = useMemo(() => {
    return ALL_QUESTS.map(q => {
      const current = q.evaluate(store);
      const isCompleted = current >= q.target;
      const isClaimed = questProgress[q.id] || false;
      return { ...q, current, isCompleted, isClaimed };
    });
  }, [store, questProgress]);

  const filteredQuests = useMemo(() => {
    return evaluatedQuests.filter(q => {
      if (activeCategory !== 'All' && q.category !== activeCategory) return false;
      if (!showCompleted && (q.isCompleted || q.isClaimed)) return false;
      return true;
    }).sort((a, b) => {
      // Sort: Claimable first, In progress second, Claimed last.
      if (a.isCompleted && !a.isClaimed && (!b.isCompleted || b.isClaimed)) return -1;
      if (b.isCompleted && !b.isClaimed && (!a.isCompleted || a.isClaimed)) return 1;
      if (a.isClaimed && !b.isClaimed) return 1;
      if (b.isClaimed && !a.isClaimed) return -1;
      return a.target - b.target;
    });
  }, [evaluatedQuests, activeCategory, showCompleted]);

  const stats = useMemo(() => {
    const total = evaluatedQuests.length;
    const completed = evaluatedQuests.filter(q => q.isCompleted).length;
    const claimed = evaluatedQuests.filter(q => q.isClaimed).length;
    const totalPointsEarnable = evaluatedQuests.reduce((acc, q) => acc + q.rewardPoints, 0);
    const totalPointsClaimed = evaluatedQuests.filter(q => q.isClaimed).reduce((acc, q) => acc + q.rewardPoints, 0);
    return { total, completed, claimed, totalPointsEarnable, totalPointsClaimed };
  }, [evaluatedQuests]);

  const handleClaim = (q: typeof evaluatedQuests[0]) => {
    if (q.isCompleted && !q.isClaimed) {
      claimQuest(q.id, q.rewardPoints);
    }
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'Easy': return '#0ecb81';
      case 'Medium': return '#F7D060';
      case 'Hard': return '#f6465d';
      case 'Legendary': return '#a64dff';
      default: return '#848e9c';
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Volume': return <Coins size={16} />;
      case 'Trading': return <Activity size={16} />;
      case 'Leverage': return <Zap size={16} />;
      case 'Streaks': return <Trophy size={16} />;
      case 'Duels': return <Target size={16} />;
      case 'Liquidity': return <Coins size={16} />;
      case 'Time': return <Zap size={16} />;
      default: return <Filter size={16} />;
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 60 }}>
      {/* ── Header & Stats ── */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 10 }}>
          <Trophy size={36} color="#F7D060" />
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: -0.5 }}>SuperArc Quests</h1>
        </div>
        <p style={{ color: '#848e9c', margin: 0, fontSize: 15 }}>
          Complete 100 dynamic on-chain milestones to earn massive points.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 24 }}>
          <div style={{ background: '#181a20', border: '1px solid #2b3139', padding: '12px 24px', borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: '#848e9c' }}>Completion</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{stats.completed} / {stats.total}</div>
          </div>
          <div style={{ background: '#181a20', border: '1px solid #2b3139', padding: '12px 24px', borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: '#848e9c' }}>Points Claimed</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#F7D060' }}>
              {stats.totalPointsClaimed.toLocaleString()} <span style={{ fontSize: 14, color: '#848e9c' }}>/ {stats.totalPointsEarnable.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {!address && (
        <div style={{
          background: 'rgba(246, 70, 93, 0.1)', border: '1px solid rgba(246, 70, 93, 0.3)',
          padding: 20, borderRadius: 12, textAlign: 'center', marginBottom: 30, color: '#f6465d'
        }}>
          <strong>Wallet not connected!</strong> Please connect your wallet to start tracking quest progress.
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {['All', 'Trading', 'Volume', 'Leverage', 'Streaks', 'Duels', 'Liquidity', 'Time'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat as CategoryFilter)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: activeCategory === cat ? 'rgba(247, 208, 96, 0.1)' : 'transparent',
                border: `1px solid ${activeCategory === cat ? '#F7D060' : '#2b3139'}`,
                color: activeCategory === cat ? '#F7D060' : '#848e9c',
                padding: '8px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              {getCategoryIcon(cat)}
              {cat}
            </button>
          ))}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#848e9c', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={showCompleted} 
            onChange={(e) => setShowCompleted(e.target.checked)} 
            style={{ accentColor: '#F7D060' }}
          />
          Show Completed
        </label>
      </div>

      {/* ── Quests Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: 16 }}>
        {filteredQuests.map(quest => {
          const progressPercent = Math.min((quest.current / quest.target) * 100, 100);
          const diffColor = getDifficultyColor(quest.difficulty);

          return (
            <div key={quest.id} style={{
              background: '#181a20',
              border: `1px solid ${quest.isClaimed ? '#2b3139' : quest.isCompleted ? '#0ecb81' : '#2b3139'}`,
              borderRadius: 16,
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              transition: 'all 0.2s',
              opacity: quest.isClaimed ? 0.6 : 1,
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: quest.isCompleted ? 'rgba(14, 203, 129, 0.1)' : `rgba(255,255,255,0.03)`,
                    border: `1px solid ${quest.isCompleted ? 'rgba(14, 203, 129, 0.3)' : '#2b3139'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {quest.isClaimed ? <CheckCircle2 size={22} color="#0ecb81" /> : getCategoryIcon(quest.category)}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: quest.isClaimed ? '#848e9c' : '#fff' }}>
                        {quest.title}
                      </h3>
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: `1px solid ${diffColor}`, color: diffColor, background: `${diffColor}10` }}>
                        {quest.difficulty}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: '#848e9c', lineHeight: 1.4 }}>
                      {quest.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress & Action */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                    <span style={{ color: '#848e9c' }}>Progress</span>
                    <span style={{ color: quest.isCompleted ? '#0ecb81' : '#fff', fontWeight: 600 }}>
                      {quest.current.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {quest.target.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: '#0b0e11', borderRadius: 3, overflow: 'hidden', border: '1px solid #2b3139' }}>
                    <div style={{
                      height: '100%', width: `${progressPercent}%`,
                      background: quest.isCompleted ? '#0ecb81' : diffColor,
                      borderRadius: 3, transition: 'width 0.5s ease-out'
                    }} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#F7D060', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Gift size={14} /> {quest.rewardPoints.toLocaleString()} PTS
                  </div>
                  
                  {quest.isClaimed ? (
                    <button disabled style={{ background: '#2b3139', color: '#848e9c', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                      Claimed
                    </button>
                  ) : quest.isCompleted ? (
                    <button 
                      onClick={() => handleClaim(quest as any)}
                      style={{ background: '#0ecb81', color: '#000', border: 'none', padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 10px rgba(14,203,129,0.3)' }}
                    >
                      Claim Reward
                    </button>
                  ) : (
                    <button disabled style={{ background: 'transparent', color: '#848e9c', border: '1px solid #2b3139', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                      Incomplete
                    </button>
                  )}
                </div>
              </div>

            </div>
          );
        })}
      </div>
      
      {filteredQuests.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#848e9c' }}>
          No quests found for these filters.
        </div>
      )}
    </div>
  );
};

export default QuestView;
