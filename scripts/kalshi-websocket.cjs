/**
 * Kalshi WebSocket Client for Real-Time Market Data
 * Connects to wss://api.elections.kalshi.com/trade-api/ws/v2
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Orderbook delta processing
 * - Sequence number validation
 * - Heartbeat/ping management
 */

const WebSocket = require('ws');
const crypto = require('crypto');

class KalshiWebSocketClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.KALSHI_API_KEY;
    this.privateKey = options.privateKey || process.env.KALSHI_PRIVATE_KEY;
    this.baseUrl = options.baseUrl || 'wss://api.elections.kalshi.com/trade-api/ws/v2';
    
    this.ws = null;
    this.subscriptions = new Map(); // sid -> { ticker, callback, lastSeq }
    this.orderbooks = new Map(); // ticker -> orderbook state
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.heartbeatInterval = null;
    this.isConnecting = false;
    
    this.onConnect = options.onConnect || (() => {});
    this.onDisconnect = options.onDisconnect || (() => {});
    this.onError = options.onError || (() => {});
  }

  /**
   * Sign WebSocket authentication request
   */
  signRequest(timestamp) {
    if (!this.privateKey || !this.apiKey) {
      throw new Error('Missing API credentials');
    }

    // Format private key
    const formattedKey = this.privateKey
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    const stringToSign = `${timestamp}GET/ws/v2`;
    
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(stringToSign);
    sign.end();

    return sign.sign({
      key: formattedKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    }, 'base64');
  }

  /**
   * Connect to WebSocket
   */
  async connect() {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;

    try {
      const timestamp = Date.now().toString();
      const signature = this.signRequest(timestamp);

      const url = `${this.baseUrl}?key=${this.apiKey}&timestamp=${timestamp}&signature=${encodeURIComponent(signature)}`;
      
      console.log('🔌 Connecting to Kalshi WebSocket...');
      this.ws = new WebSocket(url);

      this.ws.on('open', () => this.handleOpen());
      this.ws.on('message', (data) => this.handleMessage(data));
      this.ws.on('close', (code, reason) => this.handleClose(code, reason));
      this.ws.on('error', (error) => this.handleError(error));

    } catch (error) {
      this.isConnecting = false;
      this.onError(error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket open
   */
  handleOpen() {
    console.log('✅ WebSocket connected');
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.isConnecting = false;

    // Start heartbeat
    this.startHeartbeat();

    // Resubscribe to all markets
    for (const [sid, sub] of this.subscriptions) {
      this.sendSubscribe(sub.ticker, sid);
    }

    this.onConnect();
  }

  /**
   * Handle incoming messages
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'orderbook_snapshot':
          this.handleOrderbookSnapshot(message);
          break;
        case 'orderbook_delta':
          this.handleOrderbookDelta(message);
          break;
        case 'trade':
          this.handleTrade(message);
          break;
        case 'pong':
          // Heartbeat response
          break;
        case 'error':
          console.error('WebSocket error message:', message);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Handle orderbook snapshot (initial full state)
   */
  handleOrderbookSnapshot(message) {
    const { sid, seq, yes_dollars_fp, no_dollars_fp } = message;
    const sub = this.subscriptions.get(sid);
    
    if (!sub) return;

    // Store orderbook state
    this.orderbooks.set(sub.ticker, {
      seq,
      yesBids: this.parseOrderbookLevel(yes_dollars_fp),
      noBids: this.parseOrderbookLevel(no_dollars_fp),
      lastUpdate: Date.now()
    });

    sub.lastSeq = seq;
    
    // Notify callback
    if (sub.callback) {
      sub.callback('snapshot', this.getDerivedOrderbook(sub.ticker));
    }
  }

  /**
   * Handle orderbook delta (incremental updates)
   */
  handleOrderbookDelta(message) {
    const { sid, seq, deltas } = message;
    const sub = this.subscriptions.get(sid);
    
    if (!sub) return;

    const book = this.orderbooks.get(sub.ticker);
    if (!book) {
      console.warn(`Received delta for unknown orderbook: ${sub.ticker}`);
      return;
    }

    // Check sequence number
    if (seq !== book.seq + 1) {
      console.error(`Sequence gap detected: expected ${book.seq + 1}, got ${seq}`);
      this.resubscribe(sid);
      return;
    }

    // Apply deltas
    for (const delta of deltas) {
      const { side, price_dollars, delta_fp } = delta;
      const priceCents = Math.round(price_dollars * 100);
      
      if (side === 'yes') {
        this.updateOrderbookLevel(book.yesBids, priceCents, delta_fp);
      } else {
        this.updateOrderbookLevel(book.noBids, priceCents, delta_fp);
      }
    }

    book.seq = seq;
    book.lastUpdate = Date.now();
    sub.lastSeq = seq;

    // Notify callback
    if (sub.callback) {
      sub.callback('delta', this.getDerivedOrderbook(sub.ticker));
    }
  }

  /**
   * Handle trade messages
   */
  handleTrade(message) {
    const { sid, price, size, side } = message;
    const sub = this.subscriptions.get(sid);
    
    if (sub && sub.callback) {
      sub.callback('trade', { price, size, side, ticker: sub.ticker });
    }
  }

  /**
   * Parse orderbook level from API format
   */
  parseOrderbookLevel(levels) {
    const result = new Map();
    if (Array.isArray(levels)) {
      for (const [priceDollars, size] of levels) {
        const priceCents = Math.round(priceDollars * 100);
        result.set(priceCents, size);
      }
    }
    return result;
  }

  /**
   * Update orderbook level with delta
   */
  updateOrderbookLevel(levels, price, delta) {
    const current = levels.get(price) || 0;
    const updated = current + delta;
    
    if (updated <= 0) {
      levels.delete(price);
    } else {
      levels.set(price, updated);
    }
  }

  /**
   * Get derived orderbook with reciprocity
   * YES Ask = 100 - max(NO Bid)
   * NO Ask = 100 - max(YES Bid)
   */
  getDerivedOrderbook(ticker) {
    const book = this.orderbooks.get(ticker);
    if (!book) return null;

    // Get best bids (highest price)
    const yesBids = Array.from(book.yesBids.entries())
      .sort((a, b) => b[0] - a[0]);
    const noBids = Array.from(book.noBids.entries())
      .sort((a, b) => b[0] - a[0]);

    const bestYesBid = yesBids[0] || [0, 0];
    const bestNoBid = noBids[0] || [0, 0];

    // Derive asks using reciprocity
    const yesAsk = 100 - bestNoBid[0];
    const noAsk = 100 - bestYesBid[0];

    return {
      ticker,
      yes: {
        bid: bestYesBid[0],
        bidSize: bestYesBid[1],
        ask: yesAsk,
        spread: yesAsk - bestYesBid[0]
      },
      no: {
        bid: bestNoBid[0],
        bidSize: bestNoBid[1],
        ask: noAsk,
        spread: noAsk - bestNoBid[0]
      },
      seq: book.seq,
      lastUpdate: book.lastUpdate
    };
  }

  /**
   * Subscribe to a market
   */
  subscribe(ticker, callback) {
    const sid = `sub_${ticker}_${Date.now()}`;
    
    this.subscriptions.set(sid, {
      ticker,
      callback,
      lastSeq: 0
    });

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(ticker, sid);
    }

    return sid;
  }

  /**
   * Send subscribe message
   */
  sendSubscribe(ticker, sid) {
    this.send({
      type: 'subscribe',
      channel: 'orderbook_delta',
      market_ticker: ticker,
      sid
    });
  }

  /**
   * Unsubscribe from a market
   */
  unsubscribe(sid) {
    const sub = this.subscriptions.get(sid);
    if (!sub) return;

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'unsubscribe',
        sid
      });
    }

    this.subscriptions.delete(sid);
    this.orderbooks.delete(sub.ticker);
  }

  /**
   * Resubscribe (for sequence error recovery)
   */
  resubscribe(sid) {
    const sub = this.subscriptions.get(sid);
    if (!sub) return;

    console.log(`Resubscribing to ${sub.ticker} due to sequence error`);
    
    // Clear orderbook state
    this.orderbooks.delete(sub.ticker);
    
    // Unsubscribe and resubscribe
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'unsubscribe', sid });
      setTimeout(() => this.sendSubscribe(sub.ticker, sid), 100);
    }
  }

  /**
   * Send message to WebSocket
   */
  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Start heartbeat
   */
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Handle WebSocket close
   */
  handleClose(code, reason) {
    console.log(`WebSocket closed: ${code} ${reason}`);
    this.stopHeartbeat();
    this.isConnecting = false;
    this.onDisconnect(code, reason);
    this.scheduleReconnect();
  }

  /**
   * Handle WebSocket error
   */
  handleError(error) {
    console.error('WebSocket error:', error);
    this.onError(error);
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount() {
    return this.subscriptions.size;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

module.exports = { KalshiWebSocketClient };
