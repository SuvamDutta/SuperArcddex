import React from 'react';

export type MainTabType = 'portfolio' | 'trade' | 'liquidity' | 'transfer' | 'duel' | 'leaderboard' | 'quest';

interface TopNavigationProps {
  activeTab: MainTabType;
  onTabChange: (tab: MainTabType) => void;
}

const TopNavigation: React.FC<TopNavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs: { id: MainTabType; label: string }[] = [
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'trade', label: 'Trade' },
    { id: 'liquidity', label: 'Liquidity' },
    { id: 'transfer', label: 'Transfer USDC' },
    { id: 'duel', label: '1VS1 Trading duel' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'quest', label: 'Quests' },
  ];

  return (
    <div className="top-navigation">
      <div className="top-nav-container">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`top-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TopNavigation;
