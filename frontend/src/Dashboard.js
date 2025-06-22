import React, { useState, useEffect, useRef } from 'react';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  ReferenceLine 
} from 'recharts';
import ApexCharts from 'react-apexcharts';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaBitcoin, FaEthereum, FaChartLine, FaDownload, FaCamera,
  FaBell, FaVolumeUp, FaVolumeMute, FaCog, FaMoon, FaSun,
  FaLanguage, FaInfoCircle, FaHistory, FaWallet, FaAlignLeft,
  FaRedo, FaToggleOn, FaToggleOff, FaTrendingUp, FaGlobe
} from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import toast, { Toaster } from 'react-hot-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import io from 'socket.io-client';
import cryptoService from './services/cryptoService';
import './Dashboard.css';

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const [selectedCoin, setSelectedCoin] = useState('bitcoin');
  const [timeRange, setTimeRange] = useState('7D');
  const [priceData, setPriceData] = useState([]);
  const [volumeData, setVolumeData] = useState([]);
  const [marketData, setMarketData] = useState([]);
  const [cryptoList, setCryptoList] = useState([]);
  const [currentPrices, setCurrentPrices] = useState({});
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [language, setLanguage] = useState('en');
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [customTheme, setCustomTheme] = useState({
    primary: '#3b82f6',
    secondary: '#10b981',
    accent: '#f59e0b',
    background: '#1f2937',
    surface: '#374151'
  });

  // New enhanced features
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(10000); // 10 seconds
  const [useRealAPI, setUseRealAPI] = useState(true);
  const [compareCoins, setCompareCoins] = useState([]);
  const [showSparklines, setShowSparklines] = useState(true);
  const [marketStatus, setMarketStatus] = useState('loading');
  const [topGainers, setTopGainers] = useState([]);
  const [topLosers, setTopLosers] = useState([]);
  const [newsData, setNewsData] = useState([]);
  const [offlineMode, setOfflineMode] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date());

  const socketRef = useRef(null);
  const chartRef = useRef(null);
  const audioRef = useRef(null);

  // Available cryptocurrencies
  const availableCoins = [
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', icon: FaBitcoin, color: '#f7931a' },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', icon: FaEthereum, color: '#627eea' },
    { id: 'solana', name: 'Solana', symbol: 'SOL', color: '#9945ff' },
    { id: 'cardano', name: 'Cardano', symbol: 'ADA', color: '#0033ad' },
    { id: 'chainlink', name: 'Chainlink', symbol: 'LINK', color: '#2a5ada' }
  ];

  // Time range options
  const timeRanges = [
    { value: '1D', label: t('1 Day'), days: 1 },
    { value: '7D', label: t('7 Days'), days: 7 },
    { value: '30D', label: t('30 Days'), days: 30 },
    { value: '90D', label: t('90 Days'), days: 90 },
    { value: '1Y', label: t('1 Year'), days: 365 }
  ];

  // Initialize WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      socketRef.current = io('http://localhost:4000', {
        transports: ['websocket'],
        upgrade: true,
        rememberUpgrade: false
      });

      socketRef.current.on('connect', () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setReconnectAttempts(0);
        toast.success(t('Connected to real-time data'));
      });

      socketRef.current.on('disconnect', () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        toast.error(t('Disconnected from real-time data'));
      });

      socketRef.current.on('priceUpdate', (data) => {
        setCurrentPrices(prevPrices => ({
          ...prevPrices,
          [data.id]: data
        }));
        
        // Play sound notification if enabled
        if (soundEnabled && audioRef.current) {
          audioRef.current.play().catch(e => console.log('Audio play failed:', e));
        }
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        setIsConnected(false);
        
        // Attempt to reconnect
        if (reconnectAttempts < 5) {
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connectWebSocket();
          }, 3000 * (reconnectAttempts + 1));
        }
      });
    };

    connectWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [soundEnabled, reconnectAttempts, t]);

  // Load initial data
  useEffect(() => {
    loadCryptoData();
    loadPortfolio();
    loadAlerts();
    loadAlertHistory();
  }, [selectedCoin, timeRange]);

  // Auto-refresh functionality
  useEffect(() => {
    let interval;
    if (autoRefresh && !offlineMode) {
      interval = setInterval(() => {
        loadCurrentPrices();
      }, refreshInterval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval, offlineMode]);

  // Load current prices for all coins
  const loadCurrentPrices = async () => {
    try {
      const coinIds = availableCoins.map(coin => coin.id);
      const prices = await cryptoService.getCurrentPrices(coinIds);
      setCurrentPrices(prices);
      setLastUpdateTime(new Date());
    } catch (error) {
      console.error('Error loading current prices:', error);
      if (!offlineMode) {
        setOfflineMode(true);
        toast.error(t('Connection lost, entering offline mode'));
      }
    }
  };

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.3;
  }, []);

  // Theme management
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    
    // Apply custom theme colors
    const root = document.documentElement;
    Object.entries(customTheme).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
  }, [isDarkMode, customTheme]);

  // Language management
  useEffect(() => {
    i18n.changeLanguage(language);
    document.documentElement.dir = language === 'ur' ? 'rtl' : 'ltr';
  }, [language, i18n]);

  const loadCryptoData = async () => {
    try {
      setLastUpdateTime(new Date());
      
      // Check API availability and switch if needed
      if (useRealAPI) {
        const apiAvailable = await cryptoService.checkAPIAvailability();
        if (!apiAvailable && !offlineMode) {
          toast.warning(t('Real API unavailable, switching to mock data'));
          setOfflineMode(true);
        }
      }

      // Get coin details
      const coinData = await cryptoService.getCoinDetails(selectedCoin);
      
      // Get historical data based on timeRange
      const range = timeRanges.find(r => r.value === timeRange);
      const historicalData = await cryptoService.getHistoricalData(selectedCoin, range.days);
      
      setPriceData(historicalData);
      setVolumeData(historicalData.map(item => ({
        ...item,
        volume: item.volume || item.price * (Math.random() * 100000 + 50000)
      })));

      // Load market data for comparisons and trending
      await loadMarketData();
      await loadTopMovers();
      
    } catch (error) {
      console.error('Error loading crypto data:', error);
      toast.error(t('Failed to load crypto data'));
      setOfflineMode(true);
    }
  };

  const loadMarketData = async () => {
    try {
      const data = await cryptoService.getMarketData(10);
      setMarketData(data);
      setMarketStatus('open'); // Simplified for demo
    } catch (error) {
      console.error('Error loading market data:', error);
    }
  };

  const loadTopMovers = async () => {
    try {
      const data = await cryptoService.getMarketData(50);
      const gainers = data
        .filter(coin => coin.price_change_percentage_24h > 0)
        .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
        .slice(0, 5);
      
      const losers = data
        .filter(coin => coin.price_change_percentage_24h < 0)
        .sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
        .slice(0, 5);
      
      setTopGainers(gainers);
      setTopLosers(losers);
    } catch (error) {
      console.error('Error loading top movers:', error);
    }
  };

  const generateHistoricalData = (currentPrice, days) => {
    const data = [];
    const now = new Date();
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const volatility = 0.02 + Math.random() * 0.08; // 2-10% daily volatility
      const change = (Math.random() - 0.5) * volatility;
      const price = currentPrice * (1 + change * (i / days));
      
      data.push({
        date: date.toISOString().split('T')[0],
        timestamp: date.getTime(),
        price: parseFloat(price.toFixed(2)),
        high: parseFloat((price * 1.05).toFixed(2)),
        low: parseFloat((price * 0.95).toFixed(2)),
        open: parseFloat((price * 0.98).toFixed(2)),
        close: parseFloat((price * 1.02).toFixed(2))
      });
    }
    
    return data;
  };

  const loadPortfolio = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/v1/portfolio');
      const data = await response.json();
      setPortfolio(data || []);
    } catch (error) {
      console.error('Error loading portfolio:', error);
    }
  };

  const loadAlerts = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/v1/alerts');
      const data = await response.json();
      setAlerts(data || []);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const loadAlertHistory = async () => {
    // Mock alert history data
    const mockHistory = [
      { id: 1, symbol: 'BTC', type: 'price_above', value: 50000, triggered: new Date().toISOString() },
      { id: 2, symbol: 'ETH', type: 'price_below', value: 3000, triggered: new Date().toISOString() }
    ];
    setAlertHistory(mockHistory);
  };

  const handleExportChart = async (format) => {
    if (!chartRef.current) return;

    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
        scale: 2
      });

      if (format === 'png') {
        const link = document.createElement('a');
        link.download = `cryptoalert-${selectedCoin}-${timeRange}.png`;
        link.href = canvas.toDataURL();
        link.click();
      } else if (format === 'pdf') {
        const pdf = new jsPDF();
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 10, 10, 190, 100);
        pdf.save(`cryptoalert-${selectedCoin}-${timeRange}.pdf`);
      }

      toast.success(t('Chart exported successfully'));
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('Export failed'));
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    toast.success(t(isDarkMode ? 'Light mode enabled' : 'Dark mode enabled'));
  };

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'ur' : 'en';
    setLanguage(newLang);
    toast.success(t('Language changed'));
  };

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
    toast.success(t(soundEnabled ? 'Sound disabled' : 'Sound enabled'));
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
    toast.success(t(autoRefresh ? 'Auto-refresh disabled' : 'Auto-refresh enabled'));
  };

  const toggleAPIMode = async () => {
    if (useRealAPI) {
      cryptoService.enableMockAPI();
      setUseRealAPI(false);
      setOfflineMode(false);
      toast.info(t('Switched to mock API'));
    } else {
      const available = await cryptoService.enableRealAPI();
      if (available) {
        setUseRealAPI(true);
        setOfflineMode(false);
        toast.success(t('Switched to real API'));
        loadCurrentPrices();
      } else {
        toast.error(t('Real API unavailable'));
      }
    }
  };

  const refreshData = async () => {
    setOfflineMode(false);
    await loadCryptoData();
    await loadCurrentPrices();
    toast.success(t('Data refreshed'));
  };

  const startTutorial = () => {
    setShowTutorial(true);
    setTutorialStep(0);
  };

  const nextTutorialStep = () => {
    if (tutorialStep < 2) {
      setTutorialStep(tutorialStep + 1);
    } else {
      setShowTutorial(false);
      setTutorialStep(0);
      toast.success(t('Tutorial completed'));
    }
  };

  // Chart configurations
  const candlestickOptions = {
    chart: {
      type: 'candlestick',
      height: 350,
      background: 'transparent',
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true
        }
      }
    },
    title: {
      text: `${selectedCoin.toUpperCase()} ${t('Candlestick Chart')}`,
      align: 'left',
      style: {
        color: isDarkMode ? '#ffffff' : '#000000'
      }
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: {
          colors: isDarkMode ? '#ffffff' : '#000000'
        }
      }
    },
    yaxis: {
      tooltip: {
        enabled: true
      },
      labels: {
        style: {
          colors: isDarkMode ? '#ffffff' : '#000000'
        }
      }
    },
    theme: {
      mode: isDarkMode ? 'dark' : 'light'
    }
  };

  const candlestickSeries = [{
    name: 'Price',
    data: priceData.map(item => ({
      x: item.timestamp,
      y: [item.open, item.high, item.low, item.close]
    }))
  }];

  const marketDominanceData = availableCoins.map((coin, index) => ({
    name: coin.symbol,
    value: [35, 20, 15, 18, 12][index] || 5,
    color: coin.color
  }));

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const formatPercentage = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className={`dashboard ${isDarkMode ? 'dark' : 'light'}`}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: isDarkMode ? '#374151' : '#ffffff',
            color: isDarkMode ? '#ffffff' : '#000000',
          },
        }}
      />
      
      {/* Audio element for notifications */}
      <audio ref={audioRef} preload="auto">
        <source src="/notification.mp3" type="audio/mpeg" />
      </audio>

      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="dashboard-title">
              <FaChartLine className="title-icon" />
              {t('CryptoAlert Dashboard')}
            </h1>
            <div className="connection-status">
              <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`} />
              <span>{t(isConnected ? 'Live Data' : 'Disconnected')}</span>
            </div>
          </div>
          
          <div className="header-controls">
            <button 
              className="control-btn"
              onClick={toggleSound}
              title={t(soundEnabled ? 'Disable Sound' : 'Enable Sound')}
            >
              {soundEnabled ? <FaVolumeUp /> : <FaVolumeMute />}
            </button>
            
            <button 
              className="control-btn"
              onClick={toggleTheme}
              title={t('Toggle Theme')}
            >
              {isDarkMode ? <FaSun /> : <FaMoon />}
            </button>
            
            <button 
              className="control-btn"
              onClick={toggleLanguage}
              title={t('Toggle Language')}
            >
              <FaLanguage />
            </button>
            
            <button 
              className="control-btn"
              onClick={startTutorial}
              title={t('Tutorial')}
            >
              <FaInfoCircle />
            </button>
            
            <div className="notification-bell">
              <FaBell />
              {notifications.length > 0 && (
                <span className="notification-count">{notifications.length}</span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Controls Section */}
        <section className="controls-section">
          <div className="controls-grid">
            {/* Coin Selector */}
            <div className="control-group">
              <label>{t('Select Cryptocurrency')}</label>
              <select 
                value={selectedCoin} 
                onChange={(e) => setSelectedCoin(e.target.value)}
                className="coin-selector"
              >
                {availableCoins.map(coin => (
                  <option key={coin.id} value={coin.id}>
                    {coin.name} ({coin.symbol})
                  </option>
                ))}
              </select>
            </div>

            {/* Time Range Selector */}
            <div className="control-group">
              <label>{t('Time Range')}</label>
              <div className="time-range-buttons">
                {timeRanges.map(range => (
                  <button
                    key={range.value}
                    className={`time-btn ${timeRange === range.value ? 'active' : ''}`}
                    onClick={() => setTimeRange(range.value)}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Export Controls */}
            <div className="control-group">
              <label>{t('Export Chart')}</label>
              <div className="export-buttons">
                <button 
                  className="export-btn"
                  onClick={() => handleExportChart('png')}
                >
                  <FaCamera /> PNG
                </button>
                <button 
                  className="export-btn"
                  onClick={() => handleExportChart('pdf')}
                >
                  <FaDownload /> PDF
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Price Cards */}
        <section className="price-cards">
          <div className="cards-grid">
            {availableCoins.map(coin => {
              const price = currentPrices[coin.id];
              return (
                <motion.div
                  key={coin.id}
                  className={`price-card ${selectedCoin === coin.id ? 'active' : ''}`}
                  onClick={() => setSelectedCoin(coin.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="card-header">
                    <div className="coin-info">
                      <div className="coin-icon" style={{ color: coin.color }}>
                        {coin.icon ? <coin.icon /> : <FaBitcoin />}
                      </div>
                      <div>
                        <h3>{coin.symbol}</h3>
                        <p>{coin.name}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="card-content">
                    <div className="price-display">
                      <span className="current-price">
                        {price ? formatPrice(price.current_price) : '$0.00'}
                      </span>
                      <span className={`price-change ${price?.price_change_24h >= 0 ? 'positive' : 'negative'}`}>
                        {price ? formatPercentage(price.price_change_percentage_24h) : '0.00%'}
                      </span>
                    </div>
                    
                    {/* Mini sparkline */}
                    <div className="sparkline">
                      <ResponsiveContainer width="100%" height={50}>
                        <LineChart data={priceData.slice(-7)}>
                          <Line 
                            type="monotone" 
                            dataKey="price" 
                            stroke={coin.color}
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Charts Section */}
        <section className="charts-section" ref={chartRef}>
          <div className="charts-grid">
            {/* Main Price Chart */}
            <div className="chart-container main-chart">
              <h3>{t('Price History')} - {selectedCoin.toUpperCase()}</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={priceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [formatPrice(value), t('Price')]}
                    labelFormatter={(label) => t('Date') + ': ' + label}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Volume Chart */}
            <div className="chart-container">
              <h3>{t('Volume Analysis')}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="volume" 
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Market Dominance */}
            <div className="chart-container">
              <h3>{t('Market Dominance')}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={marketDominanceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {marketDominanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Candlestick Chart */}
            <div className="chart-container candlestick-chart">
              <h3>{t('Candlestick Chart')}</h3>
              <ApexCharts
                options={candlestickOptions}
                series={candlestickSeries}
                type="candlestick"
                height={350}
              />
            </div>
          </div>
        </section>

        {/* Additional Features */}
        <section className="features-section">
          <div className="features-grid">
            {/* Alert History */}
            <div className="feature-card">
              <h3><FaHistory /> {t('Alert History')}</h3>
              <div className="alert-history">
                {alertHistory.map(alert => (
                  <div key={alert.id} className="alert-item">
                    <span className="alert-symbol">{alert.symbol}</span>
                    <span className="alert-type">{t(alert.type)}</span>
                    <span className="alert-value">{formatPrice(alert.value)}</span>
                    <span className="alert-time">
                      {new Date(alert.triggered).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Portfolio Summary */}
            <div className="feature-card">
              <h3><FaWallet /> {t('Portfolio Summary')}</h3>
              <div className="portfolio-summary">
                <div className="portfolio-value">
                  <span className="label">{t('Total Value')}</span>
                  <span className="value">{formatPrice(125430.50)}</span>
                </div>
                <div className="portfolio-change">
                  <span className="label">{t('24h Change')}</span>
                  <span className="value positive">+2.34%</span>
                </div>
                <div className="portfolio-pnl">
                  <span className="label">{t('P&L')}</span>
                  <span className="value positive">+15.67%</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Tutorial Modal */}
      <AnimatePresence>
        {showTutorial && (
          <motion.div
            className="tutorial-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="tutorial-modal"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <div className="tutorial-content">
                {tutorialStep === 0 && (
                  <div>
                    <h3>{t('Welcome to CryptoAlert Dashboard')}</h3>
                    <p>{t('This tutorial will guide you through the main features of your crypto dashboard.')}</p>
                  </div>
                )}
                {tutorialStep === 1 && (
                  <div>
                    <h3>{t('Real-time Data & Charts')}</h3>
                    <p>{t('Monitor live cryptocurrency prices with interactive charts and multiple visualization options.')}</p>
                  </div>
                )}
                {tutorialStep === 2 && (
                  <div>
                    <h3>{t('Alerts & Portfolio')}</h3>
                    <p>{t('Set up price alerts and track your portfolio performance with detailed analytics.')}</p>
                  </div>
                )}
              </div>
              <div className="tutorial-controls">
                <button onClick={nextTutorialStep} className="tutorial-btn">
                  {tutorialStep < 2 ? t('Next') : t('Finish')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard; 