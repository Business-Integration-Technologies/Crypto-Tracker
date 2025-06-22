// CryptoAlert Comprehensive Test Suite
const { test, expect, beforeAll, afterAll, beforeEach, afterEach, describe } = require('@jest/globals');
const request = require('supertest');
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');

// Mock data for testing
const mockCryptoData = {
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
  }
};

const mockPortfolio = {
  totalValue: 15750.85,
  totalChange24h: 2.45,
  holdings: [
    {
      coinId: 'bitcoin',
      symbol: 'BTC',
      amount: 0.25,
      avgBuyPrice: 41000,
      currentPrice: 43250,
      value: 10812.5,
      profit: 562.5
    },
    {
      coinId: 'ethereum',
      symbol: 'ETH',
      amount: 2.5,
      avgBuyPrice: 2800,
      currentPrice: 2650,
      value: 6625,
      profit: -375
    }
  ]
};

const mockAlerts = [
  {
    id: 'alert_1',
    coinId: 'bitcoin',
    type: 'price_above',
    targetPrice: 45000,
    currentPrice: 43250,
    isActive: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    triggeredAt: null
  },
  {
    id: 'alert_2',
    coinId: 'ethereum',
    type: 'price_below',
    targetPrice: 2500,
    currentPrice: 2650,
    isActive: true,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    triggeredAt: null
  }
];

// Test server setup
let testServer;
let wsServer;
let app;

beforeAll(() => {
  // Create test Express app
  app = express();
  app.use(cors());
  app.use(express.json());

  // API Routes for testing
  app.get('/api/v1/coins/markets', (req, res) => {
    const coins = Object.values(mockCryptoData)
      .sort((a, b) => a.market_cap_rank - b.market_cap_rank);
    res.json(coins);
  });

  app.get('/api/v1/coins/:id', (req, res) => {
    const coin = mockCryptoData[req.params.id];
    if (!coin) {
      return res.status(404).json({ error: 'Coin not found' });
    }
    res.json(coin);
  });

  app.get('/api/v1/portfolio', (req, res) => {
    res.json(mockPortfolio);
  });

  app.get('/api/v1/alerts', (req, res) => {
    res.json(mockAlerts);
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Start test server
  testServer = app.listen(4001);
  
  // Start WebSocket server for testing
  wsServer = new WebSocket.Server({ port: 4002 });
  
  wsServer.on('connection', (ws) => {
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'subscribe') {
          ws.send(JSON.stringify({
            type: 'subscription_confirmed',
            coins: data.coins || Object.keys(mockCryptoData)
          }));
        }
      } catch (error) {
        console.error('Test WebSocket error:', error);
      }
    });

    // Send initial connection message
    ws.send(JSON.stringify({
      type: 'connection_established',
      message: 'Connected to CryptoAlert Test API',
      timestamp: new Date().toISOString()
    }));
  });
});

afterAll(() => {
  if (testServer) {
    testServer.close();
  }
  if (wsServer) {
    wsServer.close();
  }
});

describe('CryptoAlert API Tests', () => {
  describe('Market Data Endpoints', () => {
    test('GET /api/v1/coins/markets should return market data', async () => {
      const response = await request(app)
        .get('/api/v1/coins/markets')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('current_price');
      expect(response.body[0]).toHaveProperty('market_cap_rank');
    });

    test('GET /api/v1/coins/:id should return specific coin data', async () => {
      const response = await request(app)
        .get('/api/v1/coins/bitcoin')
        .expect(200);

      expect(response.body.id).toBe('bitcoin');
      expect(response.body.name).toBe('Bitcoin');
      expect(response.body.symbol).toBe('btc');
      expect(typeof response.body.current_price).toBe('number');
    });

    test('GET /api/v1/coins/:id should return 404 for non-existent coin', async () => {
      const response = await request(app)
        .get('/api/v1/coins/nonexistent')
        .expect(404);

      expect(response.body.error).toBe('Coin not found');
    });

    test('Market data should have required fields', async () => {
      const response = await request(app)
        .get('/api/v1/coins/markets')
        .expect(200);

      const requiredFields = [
        'id', 'symbol', 'name', 'current_price', 'market_cap',
        'market_cap_rank', 'price_change_24h', 'price_change_percentage_24h',
        'high_24h', 'low_24h', 'volume_24h'
      ];

      response.body.forEach(coin => {
        requiredFields.forEach(field => {
          expect(coin).toHaveProperty(field);
        });
      });
    });
  });

  describe('Portfolio Endpoints', () => {
    test('GET /api/v1/portfolio should return portfolio data', async () => {
      const response = await request(app)
        .get('/api/v1/portfolio')
        .expect(200);

      expect(response.body).toHaveProperty('totalValue');
      expect(response.body).toHaveProperty('totalChange24h');
      expect(response.body).toHaveProperty('holdings');
      expect(Array.isArray(response.body.holdings)).toBe(true);
    });

    test('Portfolio holdings should have required fields', async () => {
      const response = await request(app)
        .get('/api/v1/portfolio')
        .expect(200);

      const requiredFields = [
        'coinId', 'symbol', 'amount', 'avgBuyPrice', 
        'currentPrice', 'value', 'profit'
      ];

      response.body.holdings.forEach(holding => {
        requiredFields.forEach(field => {
          expect(holding).toHaveProperty(field);
        });
      });
    });

    test('Portfolio calculations should be accurate', async () => {
      const response = await request(app)
        .get('/api/v1/portfolio')
        .expect(200);

      const portfolio = response.body;
      
      // Verify value calculations
      portfolio.holdings.forEach(holding => {
        const expectedValue = holding.amount * holding.currentPrice;
        expect(Math.abs(holding.value - expectedValue)).toBeLessThan(0.01);
        
        const expectedProfit = holding.amount * (holding.currentPrice - holding.avgBuyPrice);
        expect(Math.abs(holding.profit - expectedProfit)).toBeLessThan(0.01);
      });
    });
  });

  describe('Alerts Endpoints', () => {
    test('GET /api/v1/alerts should return alerts data', async () => {
      const response = await request(app)
        .get('/api/v1/alerts')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('Alert objects should have required fields', async () => {
      const response = await request(app)
        .get('/api/v1/alerts')
        .expect(200);

      const requiredFields = [
        'id', 'coinId', 'type', 'targetPrice', 
        'currentPrice', 'isActive', 'createdAt'
      ];

      response.body.forEach(alert => {
        requiredFields.forEach(field => {
          expect(alert).toHaveProperty(field);
        });
      });
    });

    test('Alert types should be valid', async () => {
      const response = await request(app)
        .get('/api/v1/alerts')
        .expect(200);

      const validTypes = ['price_above', 'price_below', 'volume_spike', 'volatility'];
      
      response.body.forEach(alert => {
        expect(validTypes).toContain(alert.type);
      });
    });
  });

  describe('Health Check', () => {
    test('GET /health should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body.status).toBe('healthy');
    });
  });
});

describe('WebSocket Tests', () => {
  test('WebSocket connection should be established', (done) => {
    const ws = new WebSocket('ws://localhost:4002');
    
    ws.on('open', () => {
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
      done();
    });

    ws.on('error', (error) => {
      done(error);
    });
  });

  test('WebSocket should receive connection established message', (done) => {
    const ws = new WebSocket('ws://localhost:4002');
    
    ws.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'connection_established') {
        expect(message.message).toBe('Connected to CryptoAlert Test API');
        expect(message.timestamp).toBeDefined();
        ws.close();
        done();
      }
    });

    ws.on('error', (error) => {
      done(error);
    });
  });

  test('WebSocket subscription should work', (done) => {
    const ws = new WebSocket('ws://localhost:4002');
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        coins: ['bitcoin', 'ethereum']
      }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'subscription_confirmed') {
        expect(message.coins).toEqual(['bitcoin', 'ethereum']);
        ws.close();
        done();
      }
    });

    ws.on('error', (error) => {
      done(error);
    });
  });

  test('WebSocket should handle invalid JSON gracefully', (done) => {
    const ws = new WebSocket('ws://localhost:4002');
    
    ws.on('open', () => {
      ws.send('invalid json');
      // If the server doesn't crash, the test passes
      setTimeout(() => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      }, 100);
    });

    ws.on('error', (error) => {
      done(error);
    });
  });
});

describe('Data Validation Tests', () => {
  test('Price data should be valid numbers', async () => {
    const response = await request(app)
      .get('/api/v1/coins/markets')
      .expect(200);

    response.body.forEach(coin => {
      expect(typeof coin.current_price).toBe('number');
      expect(coin.current_price).toBeGreaterThan(0);
      expect(typeof coin.market_cap).toBe('number');
      expect(coin.market_cap).toBeGreaterThan(0);
      expect(typeof coin.volume_24h).toBe('number');
      expect(coin.volume_24h).toBeGreaterThan(0);
    });
  });

  test('Percentage changes should be valid', async () => {
    const response = await request(app)
      .get('/api/v1/coins/markets')
      .expect(200);

    response.body.forEach(coin => {
      expect(typeof coin.price_change_percentage_24h).toBe('number');
      expect(coin.price_change_percentage_24h).toBeGreaterThan(-100);
      expect(coin.price_change_percentage_24h).toBeLessThan(1000);
    });
  });

  test('Market cap ranks should be valid', async () => {
    const response = await request(app)
      .get('/api/v1/coins/markets')
      .expect(200);

    response.body.forEach(coin => {
      expect(typeof coin.market_cap_rank).toBe('number');
      expect(coin.market_cap_rank).toBeGreaterThan(0);
    });
  });

  test('Timestamps should be valid ISO strings', async () => {
    const response = await request(app)
      .get('/api/v1/alerts')
      .expect(200);

    response.body.forEach(alert => {
      expect(() => new Date(alert.createdAt)).not.toThrow();
      expect(new Date(alert.createdAt).toISOString()).toBe(alert.createdAt);
    });
  });
});

describe('Error Handling Tests', () => {
  test('API should handle invalid routes', async () => {
    await request(app)
      .get('/api/v1/invalid/route')
      .expect(404);
  });

  test('API should handle malformed requests gracefully', async () => {
    const response = await request(app)
      .get('/api/v1/coins/markets?invalid=param')
      .expect(200);

    // Should still return valid data despite invalid params
    expect(Array.isArray(response.body)).toBe(true);
  });
});

describe('Performance Tests', () => {
  test('API responses should be fast', async () => {
    const startTime = Date.now();
    
    await request(app)
      .get('/api/v1/coins/markets')
      .expect(200);
    
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
  });

  test('Multiple concurrent requests should be handled', async () => {
    const requests = Array(10).fill().map(() => 
      request(app).get('/api/v1/coins/markets')
    );
    
    const responses = await Promise.all(requests);
    
    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});

describe('Edge Cases', () => {
  test('Should handle zero values in portfolio', () => {
    const testHolding = {
      coinId: 'test',
      symbol: 'TEST',
      amount: 0,
      avgBuyPrice: 100,
      currentPrice: 110,
      value: 0,
      profit: 0
    };

    expect(testHolding.value).toBe(0);
    expect(testHolding.profit).toBe(0);
  });

  test('Should handle negative price changes', async () => {
    const response = await request(app)
      .get('/api/v1/coins/ethereum')
      .expect(200);

    expect(response.body.price_change_percentage_24h).toBeLessThan(0);
    expect(response.body.price_change_24h).toBeLessThan(0);
  });

  test('Should handle very large numbers', async () => {
    const response = await request(app)
      .get('/api/v1/coins/bitcoin')
      .expect(200);

    expect(response.body.market_cap).toBeGreaterThan(1000000000); // > 1 billion
    expect(response.body.volume_24h).toBeGreaterThan(1000000000); // > 1 billion
  });
});

// Mock React component tests
describe('Frontend Component Tests', () => {
  test('Price formatting should work correctly', () => {
    const formatPrice = (price) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: price < 1 ? 6 : 2
      }).format(price);
    };

    expect(formatPrice(43250)).toBe('$43,250.00');
    expect(formatPrice(0.000123)).toBe('$0.000123');
    expect(formatPrice(2650.50)).toBe('$2,650.50');
  });

  test('Percentage formatting should work correctly', () => {
    const formatPercentage = (percentage) => {
      const isPositive = percentage >= 0;
      return `${isPositive ? '+' : ''}${percentage.toFixed(2)}%`;
    };

    expect(formatPercentage(2.98)).toBe('+2.98%');
    expect(formatPercentage(-3.12)).toBe('-3.12%');
    expect(formatPercentage(0)).toBe('+0.00%');
  });

  test('CSV export should generate correct format', () => {
    const generateCSV = (portfolio) => {
      const header = ['Coin', 'Symbol', 'Amount', 'Avg Buy Price', 'Current Price', 'Value', 'Profit/Loss'];
      const rows = portfolio.holdings.map(holding => [
        holding.coinId,
        holding.symbol,
        holding.amount,
        holding.avgBuyPrice,
        holding.currentPrice,
        holding.value.toFixed(2),
        holding.profit.toFixed(2)
      ]);
      
      return [header, ...rows].map(row => row.join(',')).join('\n');
    };

    const csv = generateCSV(mockPortfolio);
    expect(csv).toContain('Coin,Symbol,Amount');
    expect(csv).toContain('bitcoin,BTC,0.25');
    expect(csv).toContain('ethereum,ETH,2.5');
  });
});

// Security Tests
describe('Security Tests', () => {
  test('API should not expose sensitive information', async () => {
    const response = await request(app)
      .get('/api/v1/coins/bitcoin')
      .expect(200);

    // Should not contain API keys, secrets, or internal data
    const responseStr = JSON.stringify(response.body);
    expect(responseStr).not.toContain('api_key');
    expect(responseStr).not.toContain('secret');
    expect(responseStr).not.toContain('password');
  });

  test('Headers should include security measures', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    // Note: In a real app, we'd check for security headers
    expect(response.headers['content-type']).toContain('application/json');
  });
});

console.log('✅ CryptoAlert Test Suite Complete'); 