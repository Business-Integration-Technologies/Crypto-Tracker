const jwt = require('jsonwebtoken');
const User = require('../models/User');

class SocketManager {
  constructor() {
    this.connectedUsers = new Map(); // userId -> socket mapping
    this.userSockets = new Map(); // socketId -> userId mapping
    this.rooms = new Map(); // room -> Set of socketIds
    this.connectionStats = {
      total: 0,
      authenticated: 0,
      anonymous: 0,
      peakConnections: 0
    };
  }

  setupWebSocket(io) {
    this.io = io;

    // Middleware for authentication
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (token) {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await User.findById(decoded.id).select('-password');
          
          if (user && user.isActive) {
            socket.userId = user._id.toString();
            socket.user = user;
            socket.authenticated = true;
          } else {
            socket.authenticated = false;
          }
        } else {
          socket.authenticated = false;
        }
        
        next();
      } catch (error) {
        console.error('WebSocket authentication error:', error.message);
        socket.authenticated = false;
        next(); // Allow anonymous connections
      }
    });

    io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    console.log('✅ WebSocket server initialized');
  }

  handleConnection(socket) {
    console.log(`🔌 New WebSocket connection: ${socket.id} (${socket.authenticated ? 'Authenticated' : 'Anonymous'})`);
    
    // Update connection stats
    this.updateConnectionStats('connect', socket.authenticated);
    
    // Store socket mapping
    if (socket.authenticated && socket.userId) {
      this.connectedUsers.set(socket.userId, socket);
      this.userSockets.set(socket.id, socket.userId);
      
      // Join user's personal room
      socket.join(`user_${socket.userId}`);
      
      // Update user's last activity
      this.updateUserActivity(socket.userId);
      
      console.log(`👤 User ${socket.userId} connected (${socket.user.email})`);
    }

    // Handle socket events
    this.setupSocketEventHandlers(socket);

    // Send welcome message with connection info
    socket.emit('connected', {
      socketId: socket.id,
      authenticated: socket.authenticated,
      timestamp: new Date().toISOString(),
      stats: this.getConnectionStats()
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });
  }

  setupSocketEventHandlers(socket) {
    // Subscribe to price updates for specific cryptocurrencies
    socket.on('subscribe_prices', (symbols) => {
      if (Array.isArray(symbols)) {
        symbols.forEach(symbol => {
          socket.join(`price_${symbol.toLowerCase()}`);
        });
        console.log(`📊 Socket ${socket.id} subscribed to price updates: ${symbols.join(', ')}`);
      }
    });

    // Unsubscribe from price updates
    socket.on('unsubscribe_prices', (symbols) => {
      if (Array.isArray(symbols)) {
        symbols.forEach(symbol => {
          socket.leave(`price_${symbol.toLowerCase()}`);
        });
        console.log(`📊 Socket ${socket.id} unsubscribed from price updates: ${symbols.join(', ')}`);
      }
    });

    // Subscribe to portfolio updates (authenticated users only)
    socket.on('subscribe_portfolio', () => {
      if (socket.authenticated && socket.userId) {
        socket.join(`portfolio_${socket.userId}`);
        console.log(`📈 User ${socket.userId} subscribed to portfolio updates`);
      } else {
        socket.emit('error', { message: 'Authentication required for portfolio updates' });
      }
    });

    // Subscribe to alert notifications (authenticated users only)
    socket.on('subscribe_alerts', () => {
      if (socket.authenticated && socket.userId) {
        socket.join(`alerts_${socket.userId}`);
        console.log(`🚨 User ${socket.userId} subscribed to alert notifications`);
      } else {
        socket.emit('error', { message: 'Authentication required for alert notifications' });
      }
    });

    // Handle custom user events
    socket.on('user_action', (data) => {
      if (socket.authenticated) {
        this.handleUserAction(socket, data);
      }
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle client-side errors
    socket.on('error', (error) => {
      console.error(`❌ Socket error from ${socket.id}:`, error);
    });

    // Handle room join requests
    socket.on('join_room', (roomName) => {
      if (this.isValidRoom(roomName, socket)) {
        socket.join(roomName);
        console.log(`🏠 Socket ${socket.id} joined room: ${roomName}`);
      } else {
        socket.emit('error', { message: 'Invalid room or insufficient permissions' });
      }
    });

    // Handle room leave requests
    socket.on('leave_room', (roomName) => {
      socket.leave(roomName);
      console.log(`🏠 Socket ${socket.id} left room: ${roomName}`);
    });
  }

  handleDisconnection(socket, reason) {
    console.log(`🔌 Socket disconnected: ${socket.id} (Reason: ${reason})`);
    
    // Update connection stats
    this.updateConnectionStats('disconnect', socket.authenticated);
    
    // Clean up user mappings
    if (socket.authenticated && socket.userId) {
      this.connectedUsers.delete(socket.userId);
      this.userSockets.delete(socket.id);
      
      // Update user's last activity
      this.updateUserActivity(socket.userId);
      
      console.log(`👤 User ${socket.userId} disconnected`);
    }
  }

  handleUserAction(socket, data) {
    const { action, payload } = data;
    
    switch (action) {
      case 'update_preferences':
        this.handlePreferencesUpdate(socket, payload);
        break;
      case 'portfolio_action':
        this.handlePortfolioAction(socket, payload);
        break;
      case 'alert_action':
        this.handleAlertAction(socket, payload);
        break;
      default:
        console.warn(`Unknown user action: ${action}`);
    }
  }

  handlePreferencesUpdate(socket, preferences) {
    // Emit preferences update to user's other connected devices
    socket.to(`user_${socket.userId}`).emit('preferences_updated', preferences);
  }

  handlePortfolioAction(socket, action) {
    // Broadcast portfolio action to user's portfolio room
    socket.to(`portfolio_${socket.userId}`).emit('portfolio_action', action);
  }

  handleAlertAction(socket, action) {
    // Broadcast alert action to user's alerts room
    socket.to(`alerts_${socket.userId}`).emit('alert_action', action);
  }

  // Broadcast price updates to subscribed clients
  broadcastPriceUpdate(symbol, priceData) {
    const room = `price_${symbol.toLowerCase()}`;
    if (this.io) {
      this.io.to(room).emit('price_update', {
        symbol: symbol.toUpperCase(),
        data: priceData,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Broadcast multiple price updates
  broadcastPriceUpdates(priceUpdates) {
    Object.keys(priceUpdates).forEach(symbol => {
      this.broadcastPriceUpdate(symbol, priceUpdates[symbol]);
    });
  }

  // Send notification to specific user
  sendUserNotification(userId, notification) {
    const userRoom = `user_${userId}`;
    if (this.io) {
      this.io.to(userRoom).emit('notification', {
        ...notification,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Send alert to specific user
  sendUserAlert(userId, alert) {
    const alertRoom = `alerts_${userId}`;
    if (this.io) {
      this.io.to(alertRoom).emit('alert_triggered', {
        ...alert,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Send portfolio update to specific user
  sendPortfolioUpdate(userId, portfolioData) {
    const portfolioRoom = `portfolio_${userId}`;
    if (this.io) {
      this.io.to(portfolioRoom).emit('portfolio_update', {
        ...portfolioData,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Broadcast system-wide announcement
  broadcastAnnouncement(announcement) {
    if (this.io) {
      this.io.emit('system_announcement', {
        ...announcement,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Broadcast market data update
  broadcastMarketData(marketData) {
    if (this.io) {
      this.io.emit('market_data_update', {
        data: marketData,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Check if user is connected
  isUserConnected(userId) {
    return this.connectedUsers.has(userId);
  }

  // Get connected user socket
  getUserSocket(userId) {
    return this.connectedUsers.get(userId);
  }

  // Get user ID by socket ID
  getUserIdBySocketId(socketId) {
    return this.userSockets.get(socketId);
  }

  // Validate room access
  isValidRoom(roomName, socket) {
    // Define room access rules
    const roomRules = {
      // Public rooms (anyone can join)
      public: ['general', 'market_updates', 'announcements'],
      
      // User-specific rooms (only the user can join)
      user_specific: (room, socket) => {
        const userRoomPattern = /^(user_|portfolio_|alerts_)(.+)$/;
        const match = room.match(userRoomPattern);
        return match && match[2] === socket.userId;
      },
      
      // Price rooms (anyone can join)
      price: (room) => room.startsWith('price_'),
      
      // Admin rooms (only admins)
      admin: (room, socket) => {
        return room.startsWith('admin_') && socket.user?.role === 'admin';
      }
    };

    // Check public rooms
    if (roomRules.public.includes(roomName)) {
      return true;
    }

    // Check user-specific rooms
    if (socket.authenticated && roomRules.user_specific(roomName, socket)) {
      return true;
    }

    // Check price rooms
    if (roomRules.price(roomName)) {
      return true;
    }

    // Check admin rooms
    if (socket.authenticated && roomRules.admin(roomName, socket)) {
      return true;
    }

    return false;
  }

  // Update connection statistics
  updateConnectionStats(action, authenticated) {
    if (action === 'connect') {
      this.connectionStats.total++;
      if (authenticated) {
        this.connectionStats.authenticated++;
      } else {
        this.connectionStats.anonymous++;
      }
      
      // Update peak connections
      const currentTotal = this.connectionStats.authenticated + this.connectionStats.anonymous;
      if (currentTotal > this.connectionStats.peakConnections) {
        this.connectionStats.peakConnections = currentTotal;
      }
    } else if (action === 'disconnect') {
      this.connectionStats.total--;
      if (authenticated) {
        this.connectionStats.authenticated--;
      } else {
        this.connectionStats.anonymous--;
      }
    }
  }

  // Update user's last activity
  async updateUserActivity(userId) {
    try {
      await User.findByIdAndUpdate(userId, {
        lastLogin: new Date()
      });
    } catch (error) {
      console.error('Error updating user activity:', error);
    }
  }

  // Get connection statistics
  getConnectionStats() {
    return {
      ...this.connectionStats,
      current: this.connectionStats.authenticated + this.connectionStats.anonymous,
      rooms: this.io ? this.io.sockets.adapter.rooms.size : 0
    };
  }

  // Get active users list (admin only)
  getActiveUsers() {
    const activeUsers = [];
    this.connectedUsers.forEach((socket, userId) => {
      if (socket.user) {
        activeUsers.push({
          userId,
          email: socket.user.email,
          connectedAt: socket.handshake.time,
          rooms: Array.from(socket.rooms)
        });
      }
    });
    return activeUsers;
  }

  // Force disconnect user (admin only)
  forceDisconnectUser(userId, reason = 'Admin action') {
    const socket = this.connectedUsers.get(userId);
    if (socket) {
      socket.emit('force_disconnect', { reason });
      socket.disconnect(true);
      console.log(`🔌 Force disconnected user ${userId}: ${reason}`);
      return true;
    }
    return false;
  }

  // Send message to all connected users
  broadcastToAll(event, data) {
    if (this.io) {
      this.io.emit(event, {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Send message to authenticated users only
  broadcastToAuthenticated(event, data) {
    this.connectedUsers.forEach((socket) => {
      if (socket.authenticated) {
        socket.emit(event, {
          ...data,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  // Health check for WebSocket service
  healthCheck() {
    return {
      status: 'healthy',
      connections: this.getConnectionStats(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
const socketManager = new SocketManager();

module.exports = {
  setupWebSocket: (io) => socketManager.setupWebSocket(io),
  socketManager
}; 