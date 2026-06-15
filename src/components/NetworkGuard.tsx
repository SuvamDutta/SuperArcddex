import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';

const ARC_TESTNET_CHAIN_ID = 5042002;

const NetworkGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { chainId, checkNetwork, address } = useStore();

  // On mount, if wallet is connected but wrong network, prompt to switch
  useEffect(() => {
    if (address && chainId && chainId !== ARC_TESTNET_CHAIN_ID) {
      checkNetwork();
    }
  }, [address, chainId, checkNetwork]);

  if (address && chainId !== ARC_TESTNET_CHAIN_ID && chainId !== null) {
    return (
      <div className="app-container" style={{ filter: 'blur(2px)' }}>
        {children}
        <div className="overlay">
          <div className="modal">
            <h3>Wrong Network</h3>
            <p>SuperArc Dex exclusively supports the ARC Network Testnet.</p>
            <button onClick={checkNetwork}>Switch to ARC Testnet</button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default NetworkGuard;
