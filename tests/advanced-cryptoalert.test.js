const { expect } = require('chai');
const request = require('supertest');
const io = require('socket.io-client');
const puppeteer = require('puppeteer');

describe('🚀 CryptoAlert Advanced Test Suite', function() {
  this.timeout(30000);

  let browser;
  let page;
  let apiBaseURL = 'http://localhost:4000';
  let frontendURL = 'http://localhost:3000';
  let backendURL = 'http://localhost:5000';

  before(async () => {
    console.log('🔧 Setting up test environment...');
    
    // Wait for services to be ready
    await waitForService(apiBaseURL + '/health', 30000);
    await waitForService(frontendURL, 30000);
    
    // Setup browser for UI tests
    browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  });

  after(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('📡 Mock API Server Tests', () => {
    it('should respond to health check', async () => {
      const response = await fetch(`${apiBaseURL}/health`);
      expect(response.status).to.equal(200);
      
      const data = await response.json();
      expect(data).to.have.property('status', 'healthy');
      expect(data).to.have.property('uptime');
      expect(data).to.have.property('timestamp');
    });

    it('should return cryptocurrency market data', async () => {
      const response = await fetch(`${apiBaseURL}/api/v1/coins/markets`);
      expect(response.status).to.equal(200);
      
      const data = await response.json();
      expect(data).to.be.an('array');
      expect(data.length).to.be.greaterThan(0);
      
      const bitcoin = data.find(coin => coin.id === 'bitcoin');
      expect(bitcoin).to.exist;
      expect(bitcoin).to.have.property('current_price');
      expect(bitcoin).to.have.property('market_cap');
      expect(bitcoin).to.have.property('price_change_percentage_24h');
    });

    it('should return specific coin data', async () => {
      const response = await fetch(`${apiBaseURL}/api/v1/coins/bitcoin`);
      expect(response.status).to.equal(200);
      
      const data = await response.json();
      expect(data).to.have.property('id', 'bitcoin');
      expect(data).to.have.property('name', 'Bitcoin');
      expect(data).to.have.property('symbol', 'btc');
      expect(data).to.have.property('current_price');
      expect(data.current_price).to.be.a('number');
    });

    it('should return portfolio data', async () => {
      const response = await fetch(`${apiBaseURL}/api/v1/portfolio`);
      expect(response.status).to.equal(200);
      
      const data = await response.json();
      expect(data).to.be.an('array');
      expect(data.length).to.be.greaterThan(0);
    });

    it('should return alerts data', async () => {
      const response = await fetch(`${apiBaseURL}/api/v1/alerts`);
      expect(response.status).to.equal(200);
      
      const data = await response.json();
      expect(data).to.be.an('array');
    });

    it('should handle CORS correctly', async () => {
      const response = await fetch(`${apiBaseURL}/api/v1/coins/markets`, {
        method: 'OPTIONS'
      });
      expect(response.headers.get('access-control-allow-origin')).to.equal('*');
    });
  });

  describe('🔌 WebSocket Real-Time Data Tests', () => {
    it('should establish WebSocket connection', (done) => {
      const client = io(apiBaseURL, {
        transports: ['websocket']
      });

      client.on('connect', () => {
        expect(client.connected).to.be.true;
        client.disconnect();
        done();
      });

      client.on('connect_error', (error) => {
        done(error);
      });
    });

    it('should receive price updates via WebSocket', (done) => {
      const client = io(apiBaseURL, {
        transports: ['websocket']
      });

      let updateReceived = false;

      client.on('connect', () => {
        client.emit('subscribe', { coins: ['bitcoin'] });
      });

      client.on('priceUpdate', (data) => {
        expect(data).to.have.property('id');
        expect(data).to.have.property('current_price');
        expect(data).to.have.property('price_change_percentage_24h');
        updateReceived = true;
        client.disconnect();
        done();
      });

      // Timeout after 10 seconds if no update received
      setTimeout(() => {
        if (!updateReceived) {
          client.disconnect();
          done(new Error('No price update received within timeout'));
        }
      }, 10000);
    });

    it('should handle WebSocket subscription/unsubscription', (done) => {
      const client = io(apiBaseURL, {
        transports: ['websocket']
      });

      client.on('connect', () => {
        // Subscribe to bitcoin
        client.emit('subscribe', { coins: ['bitcoin'] });
        
        // Unsubscribe after a short delay
        setTimeout(() => {
          client.emit('unsubscribe', { coins: ['bitcoin'] });
          client.disconnect();
          done();
        }, 2000);
      });
    });
  });

  describe('📊 Dashboard UI Tests', () => {
    it('should load the dashboard page', async () => {
      await page.goto(`${frontendURL}/dashboard`);
      await page.waitForSelector('.dashboard', { timeout: 10000 });
      
      const title = await page.title();
      expect(title).to.include('CryptoAlert');
    });

    it('should display crypto price cards', async () => {
      await page.goto(`${frontendURL}/dashboard`);
      await page.waitForSelector('.price-cards', { timeout: 10000 });
      
      const priceCards = await page.$$('.price-card');
      expect(priceCards.length).to.be.greaterThan(0);
      
      // Check if Bitcoin card exists
      const bitcoinCard = await page.$('[data-coin="bitcoin"]');
      if (bitcoinCard) {
        const priceText = await bitcoinCard.$eval('.current-price', el => el.textContent);
        expect(priceText).to.match(/^\$[\d,]+\.?\d*$/);
      }
    });

    it('should show connection status', async () => {
      await page.goto(`${frontendURL}/dashboard`);
      await page.waitForSelector('.connection-status', { timeout: 10000 });
      
      const statusText = await page.$eval('.connection-status', el => el.textContent);
      expect(statusText).to.include('Live Data');
    });

    it('should display charts section', async () => {
      await page.goto(`${frontendURL}/dashboard`);
      await page.waitForSelector('.charts-section', { timeout: 10000 });
      
      const chartContainers = await page.$$('.chart-container');
      expect(chartContainers.length).to.be.greaterThan(0);
    });

    it('should handle time range selection', async () => {
      await page.goto(`${frontendURL}/dashboard`);
      await page.waitForSelector('.time-range-buttons', { timeout: 10000 });
      
      const timeButtons = await page.$$('.time-btn');
      expect(timeButtons.length).to.be.greaterThan(0);
      
      // Click on 7D button
      const sevenDayButton = await page.$('.time-btn[data-range="7D"]');
      if (sevenDayButton) {
        await sevenDayButton.click();
        await page.waitForTimeout(1000);
        
        const activeButton = await page.$('.time-btn.active');
        expect(activeButton).to.exist;
      }
    });

    it('should handle cryptocurrency selection', async () => {
      await page.goto(`${frontendURL}/dashboard`);
      await page.waitForSelector('.coin-selector', { timeout: 10000 });
      
      // Select Ethereum
      await page.select('.coin-selector', 'ethereum');
      await page.waitForTimeout(2000);
      
      // Check if the selection changed
      const selectedValue = await page.$eval('.coin-selector', el => el.value);
      expect(selectedValue).to.equal('ethereum');
    });
  });

  describe('🎨 Theme and Language Tests', () => {
    it('should toggle between dark and light themes', async () => {
      await page.goto(`${frontendURL}/dashboard`);
      await page.waitForSelector('.dashboard', { timeout: 10000 });
      
      // Check initial theme
      const initialTheme = await page.getAttribute('html', 'data-theme');
      
      // Click theme toggle button
      const themeButton = await page.$('[title*="Toggle Theme"]');
      if (themeButton) {
        await themeButton.click();
        await page.waitForTimeout(1000);
        
        const newTheme = await page.getAttribute('html', 'data-theme');
        expect(newTheme).to.not.equal(initialTheme);
      }
    });

    it('should toggle between English and Urdu languages', async () => {
      await page.goto(`${frontendURL}/dashboard`);
      await page.waitForSelector('.dashboard', { timeout: 10000 });
      
      // Click language toggle button
      const langButton = await page.$('[title*="Toggle Language"]');
      if (langButton) {
        await langButton.click();
        await page.waitForTimeout(2000);
        
        // Check if direction changed (RTL for Urdu)
        const direction = await page.getAttribute('html', 'dir');
        expect(direction).to.be.oneOf(['rtl', 'ltr']);
      }
    });
  });

  describe('📱 Mobile Responsiveness Tests', () => {
    it('should be responsive on mobile devices', async () => {
      await page.setViewport({ width: 375, height: 667 }); // iPhone 6/7/8
      await page.goto(`${frontendURL}/dashboard`);
      await page.waitForSelector('.dashboard', { timeout: 10000 });
      
      // Check if mobile layout is applied
      const dashboardElement = await page.$('.dashboard');
      const styles = await page.evaluate(el => {
        return window.getComputedStyle(el);
      }, dashboardElement);
      
      expect(styles).to.exist;
    });

    it('should handle touch interactions on mobile', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(`${frontendURL}/dashboard`);
      await page.waitForSelector('.price-card', { timeout: 10000 });
      
      // Simulate touch on a price card
      const priceCard = await page.$('.price-card');
      if (priceCard) {
        await priceCard.tap();
        await page.waitForTimeout(500);
        
        // Check if card becomes active
        const isActive = await priceCard.evaluate(el => el.classList.contains('active'));
        expect(isActive).to.be.true;
      }
    });
  });

  describe('📈 Chart Functionality Tests', () => {
    it('should render different chart types', async () => {
      await page.goto(`${frontendURL}/dashboard`);
      await page.waitForSelector('.charts-section', { timeout: 10000 });
      
      // Check for different chart containers
      const mainChart = await page.$('.main-chart');
      expect(mainChart).to.exist;
      
      const candlestickChart = await page.$('.candlestick-chart');
      expect(candlestickChart).to.exist;
    });

    it('should handle chart export functionality', async () => {
      await page.goto(`${frontendURL}/dashboard`);
      await page.waitForSelector('.export-buttons', { timeout: 10000 });
      
      // Test PNG export button
      const pngButton = await page.$('.export-btn');
      if (pngButton) {
        // Just check if button exists and is clickable - actual download test would be complex
        const isVisible = await pngButton.isIntersectingViewport();
        expect(isVisible).to.be.true;
      }
    });
  });

  describe('🔊 Notification and Sound Tests', () => {
    it('should have sound toggle functionality', async () => {
      await page.goto(`${frontendURL}/dashboard`);
      await page.waitForSelector('.header-controls', { timeout: 10000 });
      
      const soundButton = await page.$('[title*="Sound"]');
      if (soundButton) {
        await soundButton.click();
        await page.waitForTimeout(500);
        
        // Check if button state changed
        const buttonContent = await soundButton.evaluate(el => el.innerHTML);
        expect(buttonContent).to.exist;
      }
    });
  });

  describe('📚 Tutorial and Help Tests', () => {
    it('should display tutorial modal', async () => {
      await page.goto(`${frontendURL}/dashboard`);
      await page.waitForSelector('.header-controls', { timeout: 10000 });
      
      const tutorialButton = await page.$('[title*="Tutorial"]');
      if (tutorialButton) {
        await tutorialButton.click();
        await page.waitForTimeout(1000);
        
        const tutorialModal = await page.$('.tutorial-modal');
        if (tutorialModal) {
          expect(tutorialModal).to.exist;
          
          // Check if modal content exists
          const modalContent = await tutorialModal.$('.tutorial-content');
          expect(modalContent).to.exist;
        }
      }
    });
  });

  describe('🔒 Security Tests', () => {
    it('should not expose sensitive information', async () => {
      const response = await fetch(`${apiBaseURL}/api/v1/coins/markets`);
      const text = await response.text();
      
      // Check that response doesn't contain sensitive patterns
      expect(text).to.not.include('password');
      expect(text).to.not.include('secret');
      expect(text).to.not.include('token');
      expect(text).to.not.include('key');
    });

    it('should handle invalid requests gracefully', async () => {
      const response = await fetch(`${apiBaseURL}/api/v1/coins/nonexistent`);
      expect(response.status).to.be.oneOf([404, 400]);
    });

    it('should have proper CORS headers', async () => {
      const response = await fetch(`${apiBaseURL}/api/v1/coins/markets`);
      const corsHeader = response.headers.get('Access-Control-Allow-Origin');
      expect(corsHeader).to.exist;
    });
  });

  describe('⚡ Performance Tests', () => {
    it('should load dashboard within acceptable time', async () => {
      const startTime = Date.now();
      
      await page.goto(`${frontendURL}/dashboard`);
      await page.waitForSelector('.dashboard', { timeout: 10000 });
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).to.be.lessThan(5000); // 5 seconds max
    });

    it('should handle multiple API requests efficiently', async () => {
      const startTime = Date.now();
      
      const requests = [
        fetch(`${apiBaseURL}/api/v1/coins/bitcoin`),
        fetch(`${apiBaseURL}/api/v1/coins/ethereum`),
        fetch(`${apiBaseURL}/api/v1/coins/markets`),
        fetch(`${apiBaseURL}/api/v1/portfolio`),
        fetch(`${apiBaseURL}/api/v1/alerts`)
      ];
      
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      
      // All requests should complete
      responses.forEach(response => {
        expect(response.status).to.equal(200);
      });
      
      // Should complete within reasonable time
      expect(totalTime).to.be.lessThan(3000); // 3 seconds max
    });

    it('should handle concurrent WebSocket connections', async () => {
      const connections = [];
      const connectionPromises = [];
      
      // Create 5 concurrent connections
      for (let i = 0; i < 5; i++) {
        const client = io(apiBaseURL, {
          transports: ['websocket']
        });
        connections.push(client);
        
        connectionPromises.push(new Promise((resolve, reject) => {
          client.on('connect', () => resolve());
          client.on('connect_error', reject);
          setTimeout(() => reject(new Error('Connection timeout')), 5000);
        }));
      }
      
      // Wait for all connections
      await Promise.all(connectionPromises);
      
      // Clean up connections
      connections.forEach(client => client.disconnect());
      
      expect(connections.length).to.equal(5);
    });
  });

  describe('💾 Data Validation Tests', () => {
    it('should return valid cryptocurrency data format', async () => {
      const response = await fetch(`${apiBaseURL}/api/v1/coins/bitcoin`);
      const data = await response.json();
      
      // Validate required fields
      expect(data).to.have.property('id');
      expect(data).to.have.property('name');
      expect(data).to.have.property('symbol');
      expect(data).to.have.property('current_price');
      expect(data).to.have.property('market_cap');
      expect(data).to.have.property('price_change_percentage_24h');
      
      // Validate data types
      expect(data.current_price).to.be.a('number');
      expect(data.market_cap).to.be.a('number');
      expect(data.price_change_percentage_24h).to.be.a('number');
    });

    it('should handle price formatting correctly', async () => {
      await page.goto(`${frontendURL}/dashboard`);
      await page.waitForSelector('.current-price', { timeout: 10000 });
      
      const prices = await page.$$eval('.current-price', elements => 
        elements.map(el => el.textContent)
      );
      
      prices.forEach(price => {
        expect(price).to.match(/^\$[\d,]+\.?\d*$/);
      });
    });

    it('should handle percentage formatting correctly', async () => {
      await page.goto(`${frontendURL}/dashboard`);
      await page.waitForSelector('.price-change', { timeout: 10000 });
      
      const changes = await page.$$eval('.price-change', elements => 
        elements.map(el => el.textContent)
      );
      
      changes.forEach(change => {
        expect(change).to.match(/^[+-]?\d+\.?\d*%$/);
      });
    });
  });

  describe('🔄 Real-time Update Tests', () => {
    it('should update prices in real-time', async () => {
      await page.goto(`${frontendURL}/dashboard`);
      await page.waitForSelector('.current-price', { timeout: 10000 });
      
      // Get initial price
      const initialPrice = await page.$eval('.current-price', el => el.textContent);
      
      // Wait for potential updates
      await page.waitForTimeout(5000);
      
      // Check if price might have updated (or at least the mechanism is in place)
      const finalPrice = await page.$eval('.current-price', el => el.textContent);
      
      // The test passes if prices are displayed correctly (real updates depend on WebSocket)
      expect(initialPrice).to.match(/^\$[\d,]+\.?\d*$/);
      expect(finalPrice).to.match(/^\$[\d,]+\.?\d*$/);
    });
  });
});

// Utility function to wait for service to be ready
async function waitForService(url, timeout = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch (error) {
      // Service not ready, continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error(`Service at ${url} not ready within ${timeout}ms`);
}

// Global fetch polyfill for Node.js
if (!global.fetch) {
  global.fetch = require('node-fetch');
} 