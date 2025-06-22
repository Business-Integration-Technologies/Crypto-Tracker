import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import AppEnhanced from './AppEnhanced';
import './i18n';
import './App.css';

function App() {
  const [cryptoData, setCryptoData] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch initial crypto data
    fetch('/api/crypto/market?limit=10')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCryptoData(data.data || []);
        }
        setConnected(true);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching crypto data:', err);
        setConnected(false);
        setLoading(false);
      });
  }, []);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(price || 0);
  };

  const formatChange = (change) => {
    return `${(change || 0).toFixed(2)}%`;
  };

  // Component that shows the old landing page
  const LandingPage = () => {
    if (loading) {
      return (
        <div className="App">
          <div className="loading">
            <h1>🚀 Loading CryptoAlert...</h1>
            <div className="spinner"></div>
          </div>
        </div>
      );
    }

    return (
      <div className="App">
        <header className="App-header">
          <h1>🚀 CryptoAlert - Blockchain Tracker</h1>
          <p className="subtitle">Professional Real-Time Cryptocurrency Tracking Platform</p>
          
          <div className="status">
            Status: <span className={connected ? 'connected' : 'disconnected'}>
              {connected ? '🟢 Connected' : '🔴 Disconnected'}
            </span>
          </div>
          
          <div className="crypto-grid">
            {cryptoData.slice(0, 6).map((coin, index) => (
              <div key={coin.id || index} className="crypto-card">
                <div className="crypto-name">
                  {coin.image && <img src={coin.image} alt={coin.name} width="24" />}
                  <span>{coin.name || 'Cryptocurrency'}</span>
                  <span className="symbol">{coin.symbol?.toUpperCase()}</span>
                </div>
                <div className="crypto-price">
                  {formatPrice(coin.current_price)}
                </div>
                <div className={`crypto-change ${(coin.price_change_percentage_24h || 0) >= 0 ? 'positive' : 'negative'}`}>
                  {formatChange(coin.price_change_percentage_24h)}
                </div>
                <div className="crypto-stats">
                  <div>Market Cap: {coin.market_cap ? `$${(coin.market_cap / 1e9).toFixed(2)}B` : 'N/A'}</div>
                  <div>Volume: {coin.total_volume ? `$${(coin.total_volume / 1e6).toFixed(2)}M` : 'N/A'}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="features">
            <h2>✨ Platform Features</h2>
            <div className="feature-grid">
              <div className="feature-card">
                <div className="feature-icon">📊</div>
                <h3>Real-Time Tracking</h3>
                <p>Live cryptocurrency prices with WebSocket updates</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🚨</div>
                <h3>Smart Alerts</h3>
                <p>Price, volume, and volatility alerts via email & SMS</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">💼</div>
                <h3>Portfolio Management</h3>
                <p>Track your investments with detailed analytics</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📱</div>
                <h3>Mobile Ready</h3>
                <p>Progressive Web App with offline capabilities</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🔒</div>
                <h3>Enterprise Security</h3>
                <p>JWT authentication, rate limiting, and encryption</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">⚡</div>
                <h3>High Performance</h3>
                <p>Redis caching and optimized Docker deployment</p>
              </div>
            </div>
          </div>

          <div className="tech-stack">
            <h2>🛠️ Technology Stack</h2>
            <div className="tech-badges">
              <span className="tech-badge">React</span>
              <span className="tech-badge">Node.js</span>
              <span className="tech-badge">MongoDB</span>
              <span className="tech-badge">Redis</span>
              <span className="tech-badge">Socket.IO</span>
              <span className="tech-badge">Docker</span>
              <span className="tech-badge">Nginx</span>
              <span className="tech-badge">CoinGecko API</span>
            </div>
          </div>
        </header>
      </div>
    );
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/enhanced" element={<AppEnhanced />} />
        <Route path="/landing" element={<LandingPage />} />
      </Routes>
    </Router>
  );
}

export default App;