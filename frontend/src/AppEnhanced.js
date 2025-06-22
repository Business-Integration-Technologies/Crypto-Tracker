import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Language translations
const translations = {
  en: {
    title: 'CryptoAlert - Blockchain Tracker',
    subtitle: 'Professional Real-Time Cryptocurrency Tracking',
    currentPrices: 'Current Cryptocurrency Prices',
    portfolio: 'Your Portfolio',
    alerts: 'Price Alerts',
    alertHistory: 'Alert History',
    downloadCsv: 'Download CSV',
    muteAlerts: 'Mute Alerts',
    snoozeAlerts: 'Snooze (1h)',
    totalValue: 'Total Value',
    change24h: 'Change (24h)',
    profit: 'Profit/Loss',
    welcome: 'Welcome to CryptoAlert!',
    tutorialStep1: 'Track real-time cryptocurrency prices with live updates',
    tutorialStep2: 'Set up price alerts to never miss important movements',
    tutorialStep3: 'Manage your portfolio and track performance',
    skipTutorial: 'Skip Tutorial',
    nextStep: 'Next Step',
    close: 'Close'
  },
  ur: {
    title: 'CryptoAlert - بلاک چین ٹریکر',
    subtitle: 'پیشہ ورانہ ریئل ٹائم کرپٹو کرنسی ٹریکنگ',
    currentPrices: 'موجودہ کرپٹو کرنسی کی قیمتیں',
    portfolio: 'آپ کا پورٹ فولیو',
    alerts: 'قیمت الرٹس',
    alertHistory: 'الرٹ تاریخ',
    downloadCsv: 'CSV ڈاؤن لوڈ کریں',
    muteAlerts: 'الرٹس خاموش کریں',
    snoozeAlerts: 'سنوز (1 گھنٹہ)',
    totalValue: 'کل قیمت',
    change24h: 'تبدیلی (24 گھنٹے)',
    profit: 'نفع/نقصان',
    welcome: 'CryptoAlert میں خوش آمدید!',
    tutorialStep1: 'لائیو اپ ڈیٹس کے ساتھ ریئل ٹائم کرپٹو کرنسی کی قیمتوں کو ٹریک کریں',
    tutorialStep2: 'اہم حرکات کو کبھی نہ چوکنے کے لیے قیمت الرٹس سیٹ کریں',
    tutorialStep3: 'اپنے پورٹ فولیو کو منظم کریں اور کارکردگی کو ٹریک کریں',
    skipTutorial: 'ٹیوٹوریل چھوڑیں',
    nextStep: 'اگلا قدم',
    close: 'بند کریں'
  }
};

function AppEnhanced() {
  const [cryptoData, setCryptoData] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [language, setLanguage] = useState('en');
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [alertsMuted, setAlertsMuted] = useState(false);
  const [alertsSnoozed, setAlertsSnoozed] = useState(false);
  const [activeTab, setActiveTab] = useState('prices');
  const socketRef = useRef(null);

  const t = translations[language];

  // Initialize WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:4000/ws';
      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onopen = () => {
        console.log('✅ WebSocket connected');
        setWsConnected(true);
        
        socketRef.current.send(JSON.stringify({
          type: 'subscribe',
          coins: ['bitcoin', 'ethereum', 'cardano', 'solana', 'chainlink']
        }));
      };

      socketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'price_update' && data.data) {
            setCryptoData(prevData => {
              const newData = [...prevData];
              data.data.forEach(coin => {
                const index = newData.findIndex(c => c.id === coin.id);
                if (index !== -1) {
                  newData[index] = { ...newData[index], ...coin };
                } else {
                  newData.push(coin);
                }
              });
              return newData;
            });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      socketRef.current.onclose = () => {
        console.log('❌ WebSocket disconnected');
        setWsConnected(false);
        setTimeout(connectWebSocket, 3000);
      };

      socketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };
    };

    connectWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:4000';
        
        const [marketResponse, portfolioResponse, alertsResponse] = await Promise.all([
          fetch(`${baseUrl}/api/v1/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10`),
          fetch(`${baseUrl}/api/v1/portfolio`),
          fetch(`${baseUrl}/api/v1/alerts`)
        ]);

        const marketData = await marketResponse.json();
        const portfolioData = await portfolioResponse.json();
        const alertsData = await alertsResponse.json();

        setCryptoData(marketData);
        setPortfolio(portfolioData);
        setAlerts(alertsData);

        // Generate mock alert history
        const mockHistory = [
          {
            id: 'hist_1',
            coinId: 'bitcoin',
            symbol: 'BTC',
            type: 'price_above',
            targetPrice: 42000,
            triggeredPrice: 42150,
            triggeredAt: new Date(Date.now() - 3600000).toISOString(),
            message: 'Bitcoin reached $42,150 (target: $42,000)'
          },
          {
            id: 'hist_2',
            coinId: 'ethereum',
            symbol: 'ETH',
            type: 'price_below',
            targetPrice: 2600,
            triggeredPrice: 2580,
            triggeredAt: new Date(Date.now() - 7200000).toISOString(),
            message: 'Ethereum dropped to $2,580 (target: $2,600)'
          }
        ];
        setAlertHistory(mockHistory);

      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  // Check if first visit for tutorial
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('cryptoalert_tutorial_seen');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, []);

  // Theme and language management
  useEffect(() => {
    document.body.className = theme;
    localStorage.setItem('cryptoalert_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('cryptoalert_language', language);
    document.documentElement.lang = language;
  }, [language]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  const toggleLanguage = () => setLanguage(prev => prev === 'en' ? 'ur' : 'en');

  const closeTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('cryptoalert_tutorial_seen', 'true');
  };

  const nextTutorialStep = () => {
    if (tutorialStep < 2) {
      setTutorialStep(prev => prev + 1);
    } else {
      closeTutorial();
    }
  };

  const downloadPortfolioCsv = () => {
    if (!portfolio) return;

    const csvContent = [
      ['Coin', 'Symbol', 'Amount', 'Avg Buy Price', 'Current Price', 'Value', 'Profit/Loss'],
      ...portfolio.holdings.map(holding => [
        holding.coinId,
        holding.symbol,
        holding.amount,
        holding.avgBuyPrice,
        holding.currentPrice,
        holding.value.toFixed(2),
        holding.profit.toFixed(2)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cryptoalert-portfolio-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: price < 1 ? 6 : 2
    }).format(price);
  };

  const formatPercentage = (percentage) => {
    const isPositive = percentage >= 0;
    return (
      <span className={`percentage ${isPositive ? 'positive' : 'negative'}`}>
        {isPositive ? '+' : ''}{percentage?.toFixed(2)}%
      </span>
    );
  };

  return (
    <div className={`App ${theme}`} dir={language === 'ur' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="app-header">
        <div className="container">
          <div className="header-content">
            <div className="logo-section">
              <h1 className="logo">{t.title}</h1>
              <p className="subtitle">{t.subtitle}</p>
            </div>
            
            <div className="header-controls">
              <div className="connection-status">
                <div className={`status-indicator ${wsConnected ? 'connected' : 'disconnected'}`}>
                  <span className="status-text">
                    {wsConnected ? '🟢 Live' : '🔴 Offline'}
                  </span>
                </div>
              </div>
              
              <div className="control-buttons">
                <button onClick={toggleTheme} className="theme-btn">
                  {theme === 'dark' ? '☀️' : '🌙'}
                </button>
                <button onClick={toggleLanguage} className="lang-btn">
                  {language === 'en' ? 'اردو' : 'EN'}
                </button>
                <button onClick={() => setShowTutorial(true)} className="tutorial-btn">
                  ❓
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        <div className="container">
          <div className="tab-buttons">
            {['prices', 'portfolio', 'alerts', 'history'].map(tab => (
              <button 
                key={tab}
                className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'prices' && '📊'} 
                {tab === 'portfolio' && '💼'} 
                {tab === 'alerts' && '🚨'} 
                {tab === 'history' && '📜'} 
                {t[tab === 'prices' ? 'currentPrices' : tab === 'portfolio' ? 'portfolio' : tab === 'alerts' ? 'alerts' : 'alertHistory']}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <div className="container">
          
          {/* Current Prices Tab */}
          {activeTab === 'prices' && (
            <section className="prices-section">
              <h2>{t.currentPrices}</h2>
              <div className="crypto-grid">
                {cryptoData.map((coin) => (
                  <div key={coin.id} className="crypto-card">
                    <div className="crypto-header">
                      <img src={coin.image} alt={coin.name} className="crypto-icon" />
                      <div className="crypto-info">
                        <h3 className="crypto-name">{coin.name}</h3>
                        <span className="crypto-symbol">{coin.symbol?.toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="crypto-price">
                      <span className="price">{formatPrice(coin.current_price)}</span>
                      {formatPercentage(coin.price_change_percentage_24h)}
                    </div>
                    <div className="crypto-stats">
                      <div className="stat">
                        <span className="stat-label">24h High:</span>
                        <span className="stat-value">{formatPrice(coin.high_24h)}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">24h Low:</span>
                        <span className="stat-value">{formatPrice(coin.low_24h)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Portfolio Tab */}
          {activeTab === 'portfolio' && portfolio && (
            <section className="portfolio-section">
              <div className="portfolio-header">
                <h2>{t.portfolio}</h2>
                <button onClick={downloadPortfolioCsv} className="download-btn">
                  📥 {t.downloadCsv}
                </button>
              </div>
              
              <div className="portfolio-summary">
                <div className="summary-card">
                  <h3>{t.totalValue}</h3>
                  <span className="total-value">{formatPrice(portfolio.totalValue)}</span>
                </div>
                <div className="summary-card">
                  <h3>{t.change24h}</h3>
                  {formatPercentage(portfolio.totalChange24h)}
                </div>
                <div className="summary-card">
                  <h3>{t.profit}</h3>
                  <span className={`profit ${portfolio.holdings.reduce((acc, h) => acc + h.profit, 0) >= 0 ? 'positive' : 'negative'}`}>
                    {formatPrice(portfolio.holdings.reduce((acc, h) => acc + h.profit, 0))}
                  </span>
                </div>
              </div>

              <div className="holdings-grid">
                {portfolio.holdings.map((holding, index) => (
                  <div key={index} className="holding-card">
                    <div className="holding-header">
                      <h4>{holding.symbol}</h4>
                      <span className="holding-amount">{holding.amount} {holding.symbol}</span>
                    </div>
                    <div className="holding-details">
                      <div className="detail">
                        <span>Avg Buy: {formatPrice(holding.avgBuyPrice)}</span>
                      </div>
                      <div className="detail">
                        <span>Current: {formatPrice(holding.currentPrice)}</span>
                      </div>
                      <div className="detail">
                        <span>Value: {formatPrice(holding.value)}</span>
                      </div>
                      <div className="detail">
                        <span className={`profit ${holding.profit >= 0 ? 'positive' : 'negative'}`}>
                          P/L: {formatPrice(holding.profit)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Alerts Tab */}
          {activeTab === 'alerts' && (
            <section className="alerts-section">
              <div className="alerts-header">
                <h2>{t.alerts}</h2>
                <div className="alert-controls">
                  <button 
                    onClick={() => setAlertsMuted(!alertsMuted)} 
                    className={`control-btn ${alertsMuted ? 'active' : ''}`}
                  >
                    {alertsMuted ? '🔇' : '🔊'} {t.muteAlerts}
                  </button>
                  <button 
                    onClick={() => {
                      setAlertsSnoozed(true);
                      setTimeout(() => setAlertsSnoozed(false), 3600000);
                    }} 
                    className={`control-btn ${alertsSnoozed ? 'active' : ''}`}
                    disabled={alertsSnoozed}
                  >
                    😴 {t.snoozeAlerts}
                  </button>
                </div>
              </div>

              <div className="alerts-grid">
                {alerts.map((alert) => (
                  <div key={alert.id} className="alert-card">
                    <div className="alert-header">
                      <h4>{alert.coinId.toUpperCase()}</h4>
                      <span className={`alert-status ${alert.isActive ? 'active' : 'inactive'}`}>
                        {alert.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="alert-details">
                      <p>Type: {alert.type.replace('_', ' ')}</p>
                      <p>Target: {formatPrice(alert.targetPrice)}</p>
                      <p>Current: {formatPrice(alert.currentPrice)}</p>
                      <p>Created: {new Date(alert.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Alert History Tab */}
          {activeTab === 'history' && (
            <section className="history-section">
              <h2>{t.alertHistory}</h2>
              <div className="history-grid">
                {alertHistory.map((historyItem) => (
                  <div key={historyItem.id} className="history-card">
                    <div className="history-header">
                      <h4>{historyItem.symbol}</h4>
                      <span className="history-time">
                        {new Date(historyItem.triggeredAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="history-details">
                      <p className="history-message">{historyItem.message}</p>
                      <div className="history-prices">
                        <span>Target: {formatPrice(historyItem.targetPrice)}</span>
                        <span>Triggered: {formatPrice(historyItem.triggeredPrice)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      </main>

      {/* Tutorial Modal */}
      {showTutorial && (
        <div className="modal-overlay">
          <div className="tutorial-modal">
            <div className="tutorial-header">
              <h2>{t.welcome}</h2>
              <button onClick={closeTutorial} className="close-btn">×</button>
            </div>
            <div className="tutorial-content">
              {tutorialStep === 0 && (
                <div className="tutorial-step">
                  <div className="step-icon">📊</div>
                  <p>{t.tutorialStep1}</p>
                </div>
              )}
              {tutorialStep === 1 && (
                <div className="tutorial-step">
                  <div className="step-icon">🚨</div>
                  <p>{t.tutorialStep2}</p>
                </div>
              )}
              {tutorialStep === 2 && (
                <div className="tutorial-step">
                  <div className="step-icon">💼</div>
                  <p>{t.tutorialStep3}</p>
                </div>
              )}
            </div>
            <div className="tutorial-footer">
              <button onClick={closeTutorial} className="skip-btn">
                {t.skipTutorial}
              </button>
              <button onClick={nextTutorialStep} className="next-btn">
                {tutorialStep < 2 ? t.nextStep : t.close}
              </button>
            </div>
            <div className="tutorial-progress">
              <div className="progress-dots">
                {[0, 1, 2].map(step => (
                  <div 
                    key={step} 
                    className={`dot ${step <= tutorialStep ? 'active' : ''}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <div className="container">
          <div className="footer-content">
            <p>&copy; 2024 CryptoAlert - Professional Blockchain Tracker</p>
            <div className="tech-badges">
              <span className="tech-badge">React 18</span>
              <span className="tech-badge">WebSocket</span>
              <span className="tech-badge">Real-time</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default AppEnhanced; 