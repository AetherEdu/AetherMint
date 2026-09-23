import React, { useState } from 'react';
import '../styles/features.css';

const apyOptions = {
   '1m': '5%',
   '3m': '12%',
   '6m': '18%',
   '1y': '32%',
   '2y': '55%'
} as const;

type LockDuration = keyof typeof apyOptions;

const StakingDashboard = () => {
  const [stakeAmount, setStakeAmount] = useState(100);
  const [lockDuration, setLockDuration] = useState<LockDuration>('3m');
  const [activeStakes, setActiveStakes] = useState([
     { id: 1, amount: 500, lock: '1y', apy: '32%', earned: 42, status: 'locked' }
  ]);

  return (
    <div className="feature-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>LEARNING TOKENOMICS & STAKING</h1>
        <div className="glass-card" style={{ padding: '0.4rem 1.5rem', background: 'rgba(0, 212, 255, 0.1)', border: '1px solid var(--primary-accent)' }}>
           BALANCE: 2,450.80 STARK
        </div>
      </div>

      <div className="grid-layout">
        <div className="glass-card">
          <h3>Token Staking Pool</h3>
           <p className="text-dim">Stake your STARK tokens to support course quality and earn passive rewards.</p>
           
           <div style={{ marginTop: '1.5rem' }}>
              <label>Amount (Tokens)</label>
              <input type="range" min="10" max="2500" value={stakeAmount} onChange={(e) => setStakeAmount(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary-accent)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                 <span>10</span>
                 <span style={{ fontWeight: 800, color: '#00ff88' }}>{stakeAmount} STARK</span>
                 <span>2500</span>
              </div>
           </div>

           <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
             {(Object.keys(apyOptions) as LockDuration[]).map(opt => (
                <button key={opt} className="glass-card" style={{ flex: '1 1 50px', border: lockDuration === opt ? '1px solid var(--primary-accent)' : 'none' }} onClick={() => setLockDuration(opt)}>
                  {opt}<br/><span style={{ fontSize: '0.7rem', color: '#00ff88' }}>{apyOptions[opt]} APY</span>
                </button>
             ))}
           </div>

           <div style={{ marginTop: '2rem', padding: '1rem', background: '#000', borderRadius: '1rem', border: '1px solid #333' }}>
              <p className="text-dim" style={{ fontSize: '0.8rem' }}>Estimated Yearly Reward</p>
              <h2 style={{ margin: 0 }}>{(stakeAmount * (parseFloat(apyOptions[lockDuration]) / 100)).toFixed(2)} STARK</h2>
           </div>

           <button className="btn-premium" style={{ width: '100%', marginTop: '1.5rem' }}>Start Staking Action</button>
        </div>

        <div className="glass-card">
           <h3>Active Stakes & Governance</h3>
           <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {activeStakes.map(s => (
                <div key={s.id} className="glass-card" style={{ marginBottom: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800 }}>{s.amount} STARK</span>
                      <span style={{ background: '#333', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>{s.lock} LOCK</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                      <div className="text-dim">Rewards: <span style={{ color: '#00ff88' }}>+{s.earned} STARK</span></div>
                      {s.status === 'locked' ? (
                          <div style={{ fontSize: '0.7rem', color: '#888' }}>UNLOCKS: NOV 2026</div>
                      ) : (
                          <button className="btn-premium" style={{ padding: '4px 12px', fontSize: '0.7rem' }}>Claim & Unstake</button>
                      )}
                   </div>
                </div>
              ))}
           </div>

           <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <h4>Governance Power (Vp)</h4>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
                 <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--secondary-accent)' }}>420</div>
                 <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                    <p style={{ fontSize: '0.8rem', margin: 0 }}>VOTING WEIGHT</p>
                    <p style={{ fontSize: '0.6rem', color: '#888', margin: 0 }}>Quadratic Factor: 8.2x</p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default StakingDashboard;
