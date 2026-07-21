import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";
import { exec } from "child_process";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Ensure logs folder and file exist
const LOGS_DIR = path.join(process.cwd(), "logs");
const LOG_FILE_PATH = path.join(LOGS_DIR, "bot.log");

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}
if (!fs.existsSync(LOG_FILE_PATH)) {
  fs.writeFileSync(
    LOG_FILE_PATH,
    `${new Date().toISOString().replace("T", " ").substring(0, 19)},000 - bot - INFO - Binance Futures Trading Bot terminal initialized\n`
  );
}

// In-memory trade simulator state (for visualization)
interface Position {
  symbol: string;
  side: "LONG" | "SHORT" | "NONE";
  entryPrice: number;
  quantity: number;
  pnl: number;
}

interface SimulatedOrder {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT" | "STOP_LIMIT";
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: "NEW" | "FILLED" | "CANCELLED" | "TRIGGERED";
  timestamp: string;
}

// Global active simulation state
let currentPrice = 61250.00;
let baseBalance = 10000.00;
let activeTradingMode: "SIMULATION" | "LIVE" = "SIMULATION";
let position: Position = {
  symbol: "BTCUSDT",
  side: "NONE",
  entryPrice: 0,
  quantity: 0,
  pnl: 0
};
let ordersList: SimulatedOrder[] = [
  {
    id: "172152012300",
    symbol: "BTCUSDT",
    side: "BUY",
    type: "LIMIT",
    quantity: 0.1,
    price: 60500,
    status: "NEW",
    timestamp: new Date().toISOString()
  }
];

// Helper to write to logs file
function appendToLogFile(message: string) {
  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19) + ",123";
  const logLine = `${timestamp} - bot - INFO - ${message}\n`;
  fs.appendFileSync(LOG_FILE_PATH, logLine);
}

// Helper to calculate HMAC signature for Binance Futures API
function generateBinanceSignature(queryString: string, apiSecret: string): string {
  return crypto
    .createHmac("sha256", apiSecret)
    .update(queryString)
    .digest("hex");
}

// GET simulation state
app.get("/api/state", (req, res) => {
  // Simulate minor price fluctuation
  const delta = (Math.random() - 0.5) * 45;
  currentPrice = Math.max(1000, Number((currentPrice + delta).toFixed(2)));
  
  // Calculate PnL if active position
  if (position.side !== "NONE" && position.entryPrice > 0) {
    const diff = currentPrice - position.entryPrice;
    const factor = position.side === "LONG" ? 1 : -1;
    position.pnl = Number((diff * position.quantity * factor).toFixed(2));
  } else {
    position.pnl = 0;
  }

  // Auto-trigger limit or stop-limit orders in simulation
  ordersList = ordersList.map((o) => {
    if (o.status !== "NEW") return o;
    
    if (o.type === "LIMIT" && o.price) {
      const hit = o.side === "BUY" ? currentPrice <= o.price : currentPrice >= o.price;
      if (hit) {
        // Fill order
        o.status = "FILLED";
        appendToLogFile(`[SIMULATION] LIMIT Order Triggered! Filled Order ID ${o.id} at ${o.price}`);
        // Create/Update position
        if (position.side === "NONE") {
          position.side = o.side === "BUY" ? "LONG" : "SHORT";
          position.entryPrice = o.price;
          position.quantity = o.quantity;
        } else {
          // Adjust position or close
          const sameSide = (position.side === "LONG" && o.side === "BUY") || (position.side === "SHORT" && o.side === "SELL");
          if (sameSide) {
            const totalQty = position.quantity + o.quantity;
            const avgPrice = ((position.entryPrice * position.quantity) + (o.price * o.quantity)) / totalQty;
            position.entryPrice = Number(avgPrice.toFixed(2));
            position.quantity = totalQty;
          } else {
            // Opposite side
            if (position.quantity > o.quantity) {
              position.quantity = Number((position.quantity - o.quantity).toFixed(4));
            } else if (position.quantity === o.quantity) {
              position.side = "NONE";
              position.entryPrice = 0;
              position.quantity = 0;
            } else {
              position.side = o.side === "BUY" ? "LONG" : "SHORT";
              position.entryPrice = o.price;
              position.quantity = Number((o.quantity - position.quantity).toFixed(4));
            }
          }
        }
      }
    } else if (o.type === "STOP_LIMIT" && o.stopPrice && o.price) {
      // First check if stopPrice is hit to trigger limit order
      const triggerHit = o.side === "BUY" ? currentPrice >= o.stopPrice : currentPrice <= o.stopPrice;
      if (triggerHit) {
        // Change type to LIMIT and place it or execute directly for simplicity
        o.status = "TRIGGERED";
        appendToLogFile(`[SIMULATION] STOP_LIMIT Order Triggered at stop price ${o.stopPrice}! Placing limit order at ${o.price}`);
        // Convert to a limit order in active list
        setTimeout(() => {
          ordersList.push({
            id: (Number(o.id) + 1).toString(),
            symbol: o.symbol,
            side: o.side,
            type: "LIMIT",
            quantity: o.quantity,
            price: o.price,
            status: "NEW",
            timestamp: new Date().toISOString()
          });
        }, 500);
      }
    }
    return o;
  });

  const hasKeys = !!(
    process.env.BINANCE_API_KEY && 
    process.env.BINANCE_API_SECRET && 
    process.env.BINANCE_API_KEY !== "MY_BINANCE_API_KEY" && 
    !process.env.BINANCE_API_KEY.startsWith("MY_GEMINI_API")
  );

  res.json({
    currentPrice,
    balance: Number(baseBalance.toFixed(2)),
    position,
    orders: ordersList,
    apiConfigured: hasKeys,
    activeTradingMode
  });
});

// GET logs from bot.log
app.get("/api/logs", (req, res) => {
  try {
    if (fs.existsSync(LOG_FILE_PATH)) {
      const logsContent = fs.readFileSync(LOG_FILE_PATH, "utf-8");
      const lines = logsContent.trim().split("\n").filter(Boolean);
      // Return last 200 log lines to keep UI fast
      res.json({ logs: lines.slice(-200) });
    } else {
      res.json({ logs: ["No logs generated yet."] });
    }
  } catch (error: any) {
    res.status(500).json({ error: "Failed to read logs: " + error.message });
  }
});

// DELETE logs (reset logs)
app.post("/api/logs/clear", (req, res) => {
  try {
    fs.writeFileSync(
      LOG_FILE_PATH,
      `${new Date().toISOString().replace("T", " ").substring(0, 19)},000 - bot - INFO - Logs cleared by user\n`
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Cancel simulated order
app.post("/api/order/cancel", (req, res) => {
  const { id } = req.body;
  ordersList = ordersList.map(o => {
    if (o.id === id) {
      appendToLogFile(`[SIMULATION] Cancelled Order ID ${id} (${o.side} ${o.quantity} ${o.symbol})`);
      return { ...o, status: "CANCELLED" };
    }
    return o;
  });
  res.json({ success: true });
});

// POST Close simulation position
app.post("/api/position/close", (req, res) => {
  if (position.side !== "NONE") {
    appendToLogFile(`[SIMULATION] Closing position at ${currentPrice}. Side: ${position.side}, PnL: ${position.pnl}`);
    baseBalance = Number((baseBalance + position.pnl).toFixed(2));
    position = {
      symbol: "BTCUSDT",
      side: "NONE",
      entryPrice: 0,
      quantity: 0,
      pnl: 0
    };
  }
  res.json({ success: true });
});

// POST Execute new order
app.post("/api/order", async (req, res) => {
  const { symbol, side, type, quantity, price, stopPrice } = req.body;
  const isSimulation = activeTradingMode === "SIMULATION";

  const sym = (symbol || "BTCUSDT").toUpperCase();
  const s = (side || "BUY").toUpperCase();
  const t = (type || "MARKET").toUpperCase();
  const qty = parseFloat(quantity) || 0.01;
  const pr = price ? parseFloat(price) : undefined;
  const sp = stopPrice ? parseFloat(stopPrice) : undefined;

  appendToLogFile(`Placing order: Symbol=${sym}, Side=${s}, Type=${t}, Qty=${qty}, Price=${pr ?? "NONE"}, StopPrice=${sp ?? "NONE"}`);

  if (isSimulation) {
    const orderId = Date.now().toString();
    const newSimOrder: SimulatedOrder = {
      id: orderId,
      symbol: sym,
      side: s as "BUY" | "SELL",
      type: t as "MARKET" | "LIMIT" | "STOP_LIMIT",
      quantity: qty,
      price: pr,
      stopPrice: sp,
      status: t === "MARKET" ? "FILLED" : "NEW",
      timestamp: new Date().toISOString()
    };

    ordersList.push(newSimOrder);

    appendToLogFile(`[SIMULATION] Order placement simulated successfully!`);
    appendToLogFile(
      `[SIMULATION] RESULT - Symbol: ${sym}, Side: ${s}, Type: ${t}, ` +
      `Qty: ${qty}, Price: ${pr ?? "MARKET"}, StopPrice: ${sp ?? "NONE"}, ` +
      `OrderId: ${orderId}, Status: ${newSimOrder.status}`
    );

    if (t === "MARKET") {
      // Instant market fill
      const fillPrice = currentPrice;
      if (position.side === "NONE") {
        position.side = s === "BUY" ? "LONG" : "SHORT";
        position.entryPrice = fillPrice;
        position.quantity = qty;
      } else {
        // Adjust position
        const sameSide = (position.side === "LONG" && s === "BUY") || (position.side === "SHORT" && s === "SELL");
        if (sameSide) {
          const totalQty = position.quantity + qty;
          const avgPrice = ((position.entryPrice * position.quantity) + (fillPrice * qty)) / totalQty;
          position.entryPrice = Number(avgPrice.toFixed(2));
          position.quantity = totalQty;
        } else {
          // opposite side close or reverse
          if (position.quantity > qty) {
            position.quantity = Number((position.quantity - qty).toFixed(4));
          } else if (position.quantity === qty) {
            position.side = "NONE";
            position.entryPrice = 0;
            position.quantity = 0;
          } else {
            position.side = s === "BUY" ? "LONG" : "SHORT";
            position.entryPrice = fillPrice;
            position.quantity = Number((qty - position.quantity).toFixed(4));
          }
        }
      }
    }

    return res.json({
      success: true,
      simulation: true,
      order: newSimOrder
    });
  }

  // LIVE MODE: Send REST Request to Binance Futures API
  const apiSecret = process.env.BINANCE_API_SECRET || "";
  const apiKey = process.env.BINANCE_API_KEY || "";
  const useTestnet = process.env.USE_LIVE_API !== "true";
  const baseUrl = useTestnet ? "https://testnet.binancefuture.com" : "https://fapi.binance.com";

  // Map STOP_LIMIT CLI to native STOP type for Binance
  const binanceType = t === "STOP_LIMIT" ? "STOP" : t;

  const timestamp = Date.now();
  const params: Record<string, string> = {
    symbol: sym,
    side: s,
    type: binanceType,
    quantity: qty.toString(),
    timestamp: timestamp.toString()
  };

  if (binanceType === "LIMIT") {
    params.price = pr!.toString();
    params.timeInForce = "GTC";
  } else if (binanceType === "STOP") {
    params.price = pr!.toString();
    params.stopPrice = sp!.toString();
    params.timeInForce = "GTC";
  }

  const queryParts = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`);
  const queryString = queryParts.join("&");
  const signature = generateBinanceSignature(queryString, apiSecret);
  const url = `${baseUrl}/fapi/v1/order?${queryString}&signature=${signature}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": apiKey,
        "Content-Type": "application/json"
      }
    });

    const resBody = await response.text();
    const resData = JSON.parse(resBody);

    if (response.ok) {
      const orderId = resData.orderId;
      const status = resData.status || "NEW";
      appendToLogFile(`[SUCCESS] Order Placed on Binance. OrderId: ${orderId}, Status: ${status}`);
      return res.json({
        success: true,
        simulation: false,
        binanceResponse: resData
      });
    } else {
      appendToLogFile(`[ERROR] Binance API failed: ${resBody}`);
      return res.status(400).json({
        success: false,
        simulation: false,
        error: resData.msg || "Binance API placement failed"
      });
    }
  } catch (error: any) {
    appendToLogFile(`[ERROR] Unexpected request error: ${error.message}`);
    return res.status(500).json({
      success: false,
      simulation: false,
      error: error.message
    });
  }
});

// POST Test and Save API Keys for Binance Futures Testnet
app.post("/api/config/test-and-save", async (req, res) => {
  const { apiKey, apiSecret } = req.body;
  if (!apiKey || !apiSecret) {
    return res.status(400).json({ error: "API Key and API Secret are required" });
  }

  appendToLogFile(`[*] Initiating API Credentials verification request against Binance Futures Testnet...`);

  try {
    const testUrl = "https://testnet.binancefuture.com";
    const timestamp = Date.now();
    const queryString = `recvWindow=5000&timestamp=${timestamp}`;
    const signature = crypto
      .createHmac("sha256", apiSecret)
      .update(queryString)
      .digest("hex");
    const fullUrl = `${testUrl}/fapi/v1/account?${queryString}&signature=${signature}`;

    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": apiKey,
        "Content-Type": "application/json"
      }
    });

    const resText = await response.text();
    let resData;
    try {
      resData = JSON.parse(resText);
    } catch (e) {
      resData = { msg: resText };
    }

    if (response.ok) {
      appendToLogFile(`[SUCCESS] API Credentials successfully validated with Binance Futures Testnet!`);
      
      // Save in environment memory
      process.env.BINANCE_API_KEY = apiKey;
      process.env.BINANCE_API_SECRET = apiSecret;
      process.env.USE_LIVE_API = "false"; // Set to testnet

      // Persist in .env file as well so python scripts can read it!
      const envPath = path.join(process.cwd(), ".env");
      let envContent = "";
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, "utf-8");
      }
      
      // Replace or append
      const lines = envContent.split("\n").filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith("BINANCE_API_KEY=") && !trimmed.startsWith("BINANCE_API_SECRET=") && !trimmed.startsWith("USE_LIVE_API=");
      });
      lines.push(`BINANCE_API_KEY=${apiKey}`);
      lines.push(`BINANCE_API_SECRET=${apiSecret}`);
      lines.push(`USE_LIVE_API=false`);
      fs.writeFileSync(envPath, lines.join("\n") + "\n");

      return res.json({
        success: true,
        message: "API keys validated and saved successfully"
      });
    } else {
      appendToLogFile(`[ERROR] API key verification failed. Code: ${response.status}, Message: ${resData.msg || resText}`);
      return res.status(400).json({
        success: false,
        error: resData.msg || `Verification failed: HTTP ${response.status}`
      });
    }
  } catch (err: any) {
    appendToLogFile(`[ERROR] Unexpected error during API key verification: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: `Network or internal error: ${err.message}`
    });
  }
});

// POST Toggle between Simulation Mode and Live Testnet Mode
app.post("/api/config/toggle-mode", (req, res) => {
  const { mode } = req.body;
  if (mode !== "SIMULATION" && mode !== "LIVE") {
    return res.status(400).json({ error: "Invalid trading mode specified" });
  }

  const hasKeys = !!(
    process.env.BINANCE_API_KEY && 
    process.env.BINANCE_API_SECRET && 
    process.env.BINANCE_API_KEY !== "MY_BINANCE_API_KEY" && 
    !process.env.BINANCE_API_KEY.startsWith("MY_GEMINI_API")
  );

  if (mode === "LIVE" && !hasKeys) {
    return res.status(400).json({ error: "Cannot switch to Live Testnet Mode without valid configured API keys." });
  }

  activeTradingMode = mode;
  appendToLogFile(`[*] Trading mode toggled successfully to: ${mode} MODE`);
  res.json({ success: true, activeTradingMode });
});

// POST Terminal command execution proxy
app.post("/api/command", (req, res) => {
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ error: "Command required" });
  }

  appendToLogFile(`CLI execution triggered: ${command}`);

  const cmd = command.trim();
  
  // Safe whitelist of command execution
  const isPython = cmd.startsWith("python cli.py") || cmd.startsWith("python3 cli.py");
  const isGit = cmd.startsWith("git ");
  const isLs = cmd === "ls" || cmd.startsWith("ls ");
  const isCat = cmd.startsWith("cat ");

  if (isPython || isGit || isLs || isCat) {
    exec(cmd, (error, stdout, stderr) => {
      const outputLines: string[] = [];
      if (stdout) {
        outputLines.push(...stdout.split("\n"));
      }
      if (stderr) {
        outputLines.push(...stderr.split("\n"));
      }
      if (error && outputLines.length === 0) {
        outputLines.push(`Command exited with error: ${error.message}`);
      }

      // If a simulated or real order was successfully executed via CLI, we can parsed and sync
      // state if needed, but since it writes directly to logs/bot.log, the frontend's log viewer
      // will update reactively anyway!
      
      return res.json({
        success: !error,
        output: outputLines
      });
    });
  } else {
    return res.json({
      success: true,
      output: [
        `Command '${cmd}' recognized by terminal sandbox.`,
        `Usage recommendation:`,
        `  python cli.py --symbol BTCUSDT --side SELL --type STOP_LIMIT --quantity 0.01 --price 59000 --stop-price 59500`
      ]
    });
  }
});

// Vite & Static file hosting setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Binance Futures Trading Terminal running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
