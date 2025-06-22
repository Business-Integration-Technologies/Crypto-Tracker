# 🚀 CryptoAlert - Professional Blockchain Tracker

A professional-grade, real-time cryptocurrency tracking and alert platform built with modern web technologies.

## ✨ Features

- 📊 **Real-time Price Tracking** - Live cryptocurrency prices with WebSocket updates
- 🚨 **Smart Alerts** - Price, volume, and volatility alerts via email & SMS  
- 💼 **Portfolio Management** - Track investments with detailed analytics
- 📱 **Progressive Web App** - Mobile-ready with offline capabilities
- 🔒 **Enterprise Security** - JWT authentication, rate limiting, encryption
- ⚡ **High Performance** - Redis caching, optimized Docker deployment

## 🛠️ Technology Stack

- **Frontend:** React 18, Socket.IO Client, Chart.js, Styled Components
- **Backend:** Node.js, Express, Socket.IO, MongoDB, Redis
- **APIs:** CoinGecko, SendGrid, Twilio
- **Infrastructure:** Docker, Nginx, Docker Compose

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Git

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   cd ..
   ```

2. **Configure environment:**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your API keys
   ```

3. **Start with Docker:**
   ```bash
   npm run docker:up
   ```

4. **Access the application:**
   - **Frontend:** http://localhost:3000
   - **Backend API:** http://localhost:5000
   - **Production (Nginx):** http://localhost:80

## 🔧 Development

```bash
# Development mode (both frontend and backend)
npm run dev

# Backend only
npm run dev:backend

# Frontend only  
npm run dev:frontend
```

## 🐳 Docker Commands

```bash
# Build images
npm run docker:build

# Start services
npm run docker:up

# View logs
npm run docker:logs

# Stop services
npm run docker:down
```

## 📁 Project Structure

```
CryptoAlert/
├── backend/                 # Node.js backend
│   ├── src/
│   │   ├── models/         # MongoDB models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Custom middleware
│   │   └── websocket/      # Socket.IO handlers
│   ├── Dockerfile
│   └── package.json
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API clients
│   │   └── utils/          # Utilities
│   ├── Dockerfile
│   └── package.json
├── nginx/                  # Nginx configuration
├── scripts/               # Setup scripts
├── docker-compose.yml     # Docker services
└── README.md
```

## 🔑 Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

```env
# Database
MONGODB_URI=mongodb://cryptouser:cryptopass123@localhost:27017/cryptoalert
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secure-jwt-secret

# External APIs
COINGECKO_API_KEY=your-coingecko-api-key
SENDGRID_API_KEY=your-sendgrid-api-key
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
```

## 📊 API Documentation

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Cryptocurrency Data
- `GET /api/crypto/market` - Market data
- `GET /api/crypto/prices` - Current prices
- `GET /api/crypto/trending` - Trending coins

### Alerts
- `GET /api/alerts` - Get user alerts
- `POST /api/alerts` - Create new alert
- `PUT /api/alerts/:id` - Update alert
- `DELETE /api/alerts/:id` - Delete alert

## 🧪 Testing

```bash
# Run all tests
npm test

# Backend tests
npm run test:backend

# Frontend tests
npm run test:frontend
```

## 🚀 Production Deployment

The application is containerized and ready for production deployment with:

- **Security:** Helmet.js, rate limiting, CORS protection
- **Performance:** Redis caching, connection pooling
- **Monitoring:** Comprehensive logging and error tracking
- **Scalability:** Horizontal scaling with Docker Swarm/Kubernetes

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For support, email support@cryptoalert.com or join our Discord community.

---

Built with ❤️ for the cryptocurrency community
