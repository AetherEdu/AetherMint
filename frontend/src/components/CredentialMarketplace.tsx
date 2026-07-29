import React, { useState } from 'react';
import '../styles/features.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const CredentialMarketplace = () => {
  const [filter, setFilter] = useState('All');
  const [sortBy, setSortBy] = useState('Price Low-High');
  
  const categories = ['All', 'Blockchain', 'AI', 'Fullstack', 'Cybersecurity'];
  
  const mockCredentials = [
    { id: 1, title: 'Soroban Smart Contract Expert', issuer: 'AetherMint Academy', price: 450, supply: 100, trend: '+12%', category: 'Blockchain' },
    { id: 2, title: 'Generative AI Specialist', issuer: 'Deepmind Studio', price: 890, supply: 50, trend: '+28%', category: 'AI' },
    { id: 3, title: 'Rust Systems Architect', issuer: 'Mozilla Certified', price: 210, supply: 500, trend: '-2%', category: 'Fullstack' },
    { id: 4, title: 'Zero Knowledge Researcher', issuer: 'ZKVera Protocol', price: 1250, supply: 10, trend: '+45%', category: 'Blockchain' },
  ];

  return (
    <ErrorBoundary variant="default" errorTitle="Marketplace Error" errorMessage="Failed to load the credential marketplace.">
      <div className="feature-container" style={{ padding: '1rem', margin: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.75rem' }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(1rem, 4vw, 1.5rem)' }}>MICRO-CREDENTIAL MARKETPLACE</h1>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
             {categories.map(c => (
                <button key={c} className="glass-card" onClick={() => setFilter(c)} style={{ padding: '0.5rem 1rem', minHeight: '44px', minWidth: '44px', border: filter === c ? '1px solid var(--primary-accent)' : 'none', fontSize: 'clamp(0.7rem, 2.5vw, 0.875rem)' }}>
                  {c}
                </button>
             ))}
          </div>
        </div>

        <div className="grid-layout" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))' }}>
          {mockCredentials.filter(c => filter === 'All' || c.category === filter).map(cred => (
            <div key={cred.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ height: '180px', borderRadius: '0.75rem', backgroundImage: `linear-gradient(135deg, rgba(0,212,255,0.2), rgba(255,0,200,0.2)), url('https://placehold.co/400x200?text=Credential+${cred.id}')`, backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <div style={{ fontSize: '3rem', filter: 'drop-shadow(0 0 10px rgba(0,0,0,1))' }}>🏅</div>
                </div>
                <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.7)', padding: '5px 10px', borderRadius: '5px', fontSize: '0.8rem', color: 'var(--primary-accent)' }}>
                   NFT / Stellar Asset
                </div>
              </div>

              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'white' }}>{cred.title}</h3>
                <p className="text-dim" style={{ fontSize: '0.9rem', margin: '0' }}>Issuer: {cred.issuer}</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div>
                    <p className="text-dim" style={{ margin: 0, fontSize: '0.7rem' }}>Dynamic Price</p>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#00ff88' }}>{cred.price} XLM</span>
                 </div>
                 <div style={{ textAlign: 'right' }}>
                    <p className="text-dim" style={{ margin: 0, fontSize: '0.7rem' }}>Supply</p>
                    <span style={{ color: cred.supply < 50 ? '#ff4444' : '#fff' }}>{cred.supply} left</span>
                 </div>
              </div>

              <div style={{ background: 'rgba(0,255,136,0.1)', padding: '0.5rem', borderRadius: '0.5rem', textAlign: 'center', color: '#00ff88' }}>
                 Trend: {cred.trend} (Last 24h)
              </div>

              <button className="btn-premium">Buy & Transer to Wallet</button>
              <button className="glass-card" style={{ border: 'none', background: 'rgba(255,255,255,0.05)' }}>Compare Market History</button>
            </div>
          ))}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default CredentialMarketplace;
