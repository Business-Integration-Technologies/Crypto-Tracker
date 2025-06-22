const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// Middleware
app.use(cors());
app.use(express.json());

// Fake cryptocurrency data
const cryptoData = {
  bitcoin: {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    current_price: 43250.00,
    market_cap: 850000000000,
    market_cap_rank: 1,
    price_change_24h: 1250.75,
    price_change_percentage_24h: 2.98,
    circulating_supply: 19650000,
    total_supply: 21000000,
    max_supply: 21000000,
    high_24h: 44100.00,
    low_24h: 42800.00,
    volume_24h: 28500000000,
    image: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png'
  },
  ethereum: {
    id: 'ethereum',
    symbol: 'eth',
    name: 'Ethereum',
    current_price: 2650.00,
    market_cap: 320000000000,
    market_cap_rank: 2,
    price_change_24h: -85.25,
    price_change_percentage_24h: -3.12,
    circulating_supply: 120000000,
    total_supply: 120000000,
    max_supply: null,
    high_24h: 2750.00,
    low_24h: 2580.00,
    volume_24h: 15200000000,
    image: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png'
  },
  cardano: {
    id: 'cardano',
    symbol: 'ada',
    name: 'Cardano',
    current_price: 0.485,
    market_cap: 17500000000,
    market_cap_rank: 8,
    price_change_24h: 0.024,
    price_change_percentage_24h: 5.21,
    circulating_supply: 36000000000,
    total_supply: 45000000000,
    max_supply: 45000000000,
    high_24h: 0.52,
    low_24h: 0.45,
    volume_24h: 580000000,
    image: 'https://assets.coingecko.com/coins/images/975/large/cardano.png'
  },
  solana: {
    id: 'solana',
    symbol: 'sol',
    name: 'Solana',
    current_price: 98.50,
    market_cap: 45000000000,
    market_cap_rank: 5,
    price_change_24h: 4.75,
    price_change_percentage_24h: 5.07,
    circulating_supply: 456000000,
    total_supply: 580000000,
    max_supply: null,
    high_24h: 105.00,
    low_24h: 92.50,
    volume_24h: 2100000000,
    image: 'https://assets.coingecko.com/coins/images/4128/large/solana.png'
  },
  chainlink: {
    id: 'chainlink',
    symbol: 'link',
    name: 'Chainlink',
    current_price: 14.85,
    market_cap: 8500000000,
    market_cap_rank: 12,
    price_change_24h: -0.42,
    price_change_percentage_24h: -2.75,
    circulating_supply: 571000000,
    total_supply: 1000000000,
    max_supply: 1000000000,
    high_24h: 15.60,
    low_24h: 14.20,
    volume_24h: 385000000,
    image: 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png'
  }
};

// Generate realistic price variations
const generatePriceVariation = (basePrice, volatility = 0.02) => {
  const change = (Math.random() - 0.5) * 2 * volatility;
  return basePrice * (1 + change);
};

// Update prices every 2 seconds
const updatePrices = () => {
  Object.keys(cryptoData).forEach(coinId => {
    const coin = cryptoData[coinId];
    const oldPrice = coin.current_price;
    
    // Generate new price with realistic volatility
    coin.current_price = generatePriceVariation(coin.current_price, 0.005);
    
    // Update 24h change
    coin.price_change_24h = coin.current_price - oldPrice;
    coin.price_change_percentage_24h = (coin.price_change_24h / oldPrice) * 100;
    
    // Update high/low
    if (coin.current_price > coin.high_24h) coin.high_24h = coin.current_price;
    if (coin.current_price < coin.low_24h) coin.low_24h = coin.current_price;
    
    // Update volume with realistic variations
    coin.volume_24h = generatePriceVariation(coin.volume_24h, 0.1);
    coin.market_cap = coin.current_price * coin.circulating_supply;
  });
};

// Broadcast price updates via WebSocket
const broadcastPriceUpdates = () => {
  const priceUpdate = {
    type: 'price_update',
    timestamp: new Date().toISOString(),
    data: Object.values(cryptoData).map(coin => ({
      id: coin.id,
      symbol: coin.symbol,
      current_price: coin.current_price,
      price_change_percentage_24h: coin.price_change_percentage_24h
    }))
  };

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(priceUpdate));
    }
  });
};

// Update prices and broadcast every 2 seconds
setInterval(() => {
  updatePrices();
  broadcastPriceUpdates();
}, 2000);

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('🔌 WebSocket client connected');
  
  // Send initial data
  ws.send(JSON.stringify({
    type: 'connection_established',
    message: 'Connected to CryptoAlert Mock API',
    timestamp: new Date().toISOString()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 Received:', data);
      
      // Handle different message types
      switch (data.type) {
        case 'subscribe':
          ws.send(JSON.stringify({
            type: 'subscription_confirmed',
            coins: data.coins || Object.keys(cryptoData)
          }));
          break;
        case 'unsubscribe':
          ws.send(JSON.stringify({
            type: 'unsubscription_confirmed',
            coins: data.coins
          }));
          break;
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
  });
});

// API Routes

// Get market data
app.get('/api/v1/coins/markets', (req, res) => {
  const limit = parseInt(req.query.vs_currency) || 10;
  const coins = Object.values(cryptoData)
    .sort((a, b) => a.market_cap_rank - b.market_cap_rank)
    .slice(0, limit);
  
  res.json(coins);
});

// Get specific coin data
app.get('/api/v1/coins/:id', (req, res) => {
  const coin = cryptoData[req.params.id];
  if (!coin) {
    return res.status(404).json({ error: 'Coin not found' });
  }
  res.json(coin);
});

// Get trending coins
app.get('/api/v1/search/trending', (req, res) => {
  const trending = Object.values(cryptoData)
    .sort((a, b) => Math.abs(b.price_change_percentage_24h) - Math.abs(a.price_change_percentage_24h))
    .slice(0, 7)
    .map(coin => ({
      item: {
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol,
        market_cap_rank: coin.market_cap_rank,
        thumb: coin.image
      }
    }));
  
  res.json({ coins: trending });
});

// Simple prices endpoint
app.get('/api/v1/simple/price', (req, res) => {
  const ids = req.query.ids ? req.query.ids.split(',') : Object.keys(cryptoData);
  const vsCurrency = req.query.vs_currencies || 'usd';
  
  const prices = {};
  ids.forEach(id => {
    if (cryptoData[id]) {
      prices[id] = {
        [vsCurrency]: cryptoData[id].current_price
      };
    }
  });
  
  res.json(prices);
});

// Mock alerts endpoint
app.get('/api/v1/alerts', (req, res) => {
  const mockAlerts = [
    {
      id: 'alert_1',
      coinId: 'bitcoin',
      type: 'price_above',
      targetPrice: 45000,
      currentPrice: cryptoData.bitcoin.current_price,
      isActive: true,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      triggeredAt: null
    },
    {
      id: 'alert_2',
      coinId: 'ethereum',
      type: 'price_below',
      targetPrice: 2500,
      currentPrice: cryptoData.ethereum.current_price,
      isActive: true,
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      triggeredAt: null
    }
  ];
  
  res.json(mockAlerts);
});

// Mock portfolio endpoint
app.get('/api/v1/portfolio', (req, res) => {
  const mockPortfolio = {
    totalValue: 15750.85,
    totalChange24h: 2.45,
    holdings: [
      {
        coinId: 'bitcoin',
        symbol: 'BTC',
        amount: 0.25,
        avgBuyPrice: 41000,
        currentPrice: cryptoData.bitcoin.current_price,
        value: cryptoData.bitcoin.current_price * 0.25,
        profit: (cryptoData.bitcoin.current_price - 41000) * 0.25
      },
      {
        coinId: 'ethereum',
        symbol: 'ETH',
        amount: 2.5,
        avgBuyPrice: 2800,
        currentPrice: cryptoData.ethereum.current_price,
        value: cryptoData.ethereum.current_price * 2.5,
        profit: (cryptoData.ethereum.current_price - 2800) * 2.5
      }
    ]
  };
  
  res.json(mockPortfolio);
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    websocket_clients: wss.clients.size,
    uptime: process.uptime()
  });
});

// Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Mock CryptoAlert API running on port ${PORT}`);
  console.log(`📊 REST API: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`💚 Health: http://localhost:${PORT}/health`);
}); 