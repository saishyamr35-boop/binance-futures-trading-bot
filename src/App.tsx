import React, { useState, useEffect, useRef } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Terminal as TerminalIcon,
  Settings,
  Activity,
  FileText,
  CheckCircle,
  XCircle,
  Play,
  GitBranch,
  Github,
  Info,
  Lock,
  Unlock,
  Clock,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Copy,
  ChevronRight
} from "lucide-react";

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

interface Position {
  symbol: string;
  side: "LONG" | "SHORT" | "NONE";
  entryPrice: number;
  quantity: number;
  pnl: number;
}

interface MarketState {
  currentPrice: number;
  balance: number;
  position: Position;
  orders: SimulatedOrder[];
  apiConfigured: boolean;
  activeTradingMode: "SIMULATION" | "LIVE";
}

export default function App() {
  // Terminal Forms State
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT" | "STOP_LIMIT">("STOP_LIMIT");
  const [quantity, setQuantity] = useState("0.01");
  const [price, setPrice] = useState("59000");
  const [stopPrice, setStopPrice] = useState("59500");
  const [orderStatusMessage, setOrderStatusMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Live Pricing & State from Server
  const [marketState, setMarketState] = useState<MarketState>({
    currentPrice: 61250.00,
    balance: 10000.00,
    position: { symbol: "BTCUSDT", side: "NONE", entryPrice: 0, quantity: 0, pnl: 0 },
    orders: [],
    apiConfigured: false,
    activeTradingMode: "SIMULATION"
  });

  // API Config Modal State
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiSecretInput, setApiSecretInput] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showKeys, setShowKeys] = useState(false);
  
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"logs" | "git" | "python">("logs");
  const [lastDirection, setLastDirection] = useState<"up" | "down" | "flat">("flat");

  // Bash Terminal Simulator State
  const [terminalHistory, setTerminalHistory] = useState<string[]>([
    "Binance Futures Trading Bot Interactive Terminal v1.2",
    "Type 'python cli.py --help' to see usage details, or click a preset below.",
    ""
  ]);
  const [terminalInput, setTerminalInput] = useState("");
  const terminalBottomRef = useRef<HTMLDivElement>(null);
  const logsBottomRef = useRef<HTMLDivElement>(null);

  const prevPriceRef = useRef(61250.00);

  // Presets of commands for quick terminal execution
  const terminalPresets = [
    {
      label: "Run STOP_LIMIT Order (Bonus)",
      cmd: "python cli.py --symbol BTCUSDT --side SELL --type STOP_LIMIT --quantity 0.01 --price 59000 --stop-price 59500"
    },
    {
      label: "Run MARKET Buy Order",
      cmd: "python cli.py --symbol BTCUSDT --side BUY --type MARKET --quantity 0.05"
    },
    {
      label: "Run LIMIT Buy Order",
      cmd: "python cli.py --symbol BTCUSDT --side BUY --type LIMIT --quantity 0.02 --price 60100"
    },
    {
      label: "Git Status Check",
      cmd: "git status"
    },
    {
      label: "Git Log Stream",
      cmd: "git log --oneline"
    },
    {
      label: "Inspect orders.py",
      cmd: "cat orders.py"
    }
  ];

  // Fetch API State and logs periodically
  useEffect(() => {
    const fetchData = async () => {
      try {
        const resState = await fetch("/api/state");
        if (resState.ok) {
          const data: MarketState = await resState.json();
          setMarketState(data);
          
          // Determine price movement direction
          if (data.currentPrice > prevPriceRef.current) {
            setLastDirection("up");
          } else if (data.currentPrice < prevPriceRef.current) {
            setLastDirection("down");
          }
          prevPriceRef.current = data.currentPrice;

          // Track price history for mini chart
          setPriceHistory(prev => {
            const next = [...prev, data.currentPrice];
            if (next.length > 30) next.shift(); // Keep last 30 values
            return next;
          });
        }

        const resLogs = await fetch("/api/logs");
        if (resLogs.ok) {
          const logData = await resLogs.json();
          setLogs(logData.logs || []);
        }
      } catch (err) {
        console.error("Error polling backend state:", err);
      }
    };

    // Run immediately on mount
    fetchData();

    const interval = setInterval(fetchData, 1500);
    return () => clearInterval(interval);
  }, []);

  // Scroll terminal and logs to bottom on changes
  useEffect(() => {
    terminalBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalHistory]);

  useEffect(() => {
    logsBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Handle API credentials verification and storage
  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/config/test-and-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKeyInput.trim(),
          apiSecret: apiSecretInput.trim()
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setTestResult({
          success: true,
          message: "Connection verified! API keys saved successfully."
        });
        
        setTerminalHistory(prev => [
          ...prev, 
          `[SYSTEM] Binance Futures Testnet API credentials updated and validated successfully.`,
          ""
        ]);

        // Auto-toggle to Live Testnet Mode
        await handleToggleMode("LIVE");

        setTimeout(() => {
          setIsConfigModalOpen(false);
          setTestResult(null);
        }, 1500);
      } else {
        setTestResult({
          success: false,
          message: data.error || "Verification failed. Please check your credentials."
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Network error: ${err.message}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Handle toggling between Simulation and Live Testnet Mode
  const handleToggleMode = async (targetMode: "SIMULATION" | "LIVE") => {
    if (targetMode === "LIVE" && !marketState.apiConfigured) {
      setIsConfigModalOpen(true);
      return;
    }

    try {
      const response = await fetch("/api/config/toggle-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: targetMode })
      });

      if (response.ok) {
        setMarketState(prev => ({
          ...prev,
          activeTradingMode: targetMode
        }));
        
        setTerminalHistory(prev => [
          ...prev, 
          `[SYSTEM] Active trading mode changed to: ${targetMode} MODE`,
          ""
        ]);
      } else {
        const errData = await response.json();
        alert(`Failed to toggle mode: ${errData.error || "Unknown error"}`);
      }
    } catch (err: any) {
      alert(`Network error changing mode: ${err.message}`);
    }
  };

  // Handle Manual GUI Order Placement
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderStatusMessage({ text: "Submitting order to server...", type: "info" });

    try {
      const response = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          side,
          type: orderType,
          quantity,
          price: orderType !== "MARKET" ? price : undefined,
          stopPrice: orderType === "STOP_LIMIT" ? stopPrice : undefined
        })
      });

      const resData = await response.json();
      if (response.ok) {
        setOrderStatusMessage({
          text: `Order submitted successfully! ${resData.simulation ? " [Simulation Mode]" : " [Live Testnet]"}`,
          type: "success"
        });
        
        // Output to simulated terminal too!
        const logMsg = `[GUI] Placed ${side} ${quantity} ${symbol} (${orderType})`;
        setTerminalHistory(prev => [...prev, `bot@terminal:~$ ${logMsg}`, `Executing order... Done. Status: NEW`, ""]);
      } else {
        setOrderStatusMessage({
          text: `Error: ${resData.error || "Order placement failed"}`,
          type: "error"
        });
      }
    } catch (error: any) {
      setOrderStatusMessage({
        text: `Network Error: ${error.message}`,
        type: "error"
      });
    }

    setTimeout(() => setOrderStatusMessage(null), 5000);
  };

  // Handle simulated CLI terminal command run
  const executeTerminalCommand = async (cmdString: string) => {
    if (!cmdString.trim()) return;

    setTerminalHistory(prev => [...prev, `bot@terminal:~$ ${cmdString}`]);

    try {
      const response = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmdString })
      });

      const resData = await response.json();
      if (response.ok && resData.output) {
        setTerminalHistory(prev => [...prev, ...resData.output, ""]);
      } else {
        setTerminalHistory(prev => [...prev, `Error: Failed to execute terminal action`, ""]);
      }
    } catch (error: any) {
      setTerminalHistory(prev => [...prev, `Error: Connection lost - ${error.message}`, ""]);
    }

    setTerminalInput("");
  };

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeTerminalCommand(terminalInput);
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await fetch("/api/order/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleClosePosition = async () => {
    try {
      await fetch("/api/position/close", {
        method: "POST"
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearLogs = async () => {
    try {
      const res = await fetch("/api/logs/clear", { method: "POST" });
      if (res.ok) {
        setLogs(["Logs cleared."]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  // Compute SVG Points for the Chart
  const renderChartPoints = () => {
    if (priceHistory.length < 2) return "";
    const min = Math.min(...priceHistory) * 0.9995;
    const max = Math.max(...priceHistory) * 1.0005;
    const range = max - min || 1;
    
    const width = 500;
    const height = 150;

    return priceHistory
      .map((price, index) => {
        const x = (index / (priceHistory.length - 1)) * width;
        const y = height - ((price - min) / range) * height;
        return `${x},${y}`;
      })
      .join(" ");
  };

  const renderChartAreaPoints = () => {
    const pts = renderChartPoints();
    if (!pts) return "";
    const width = 500;
    const height = 150;
    return `0,${height} ${pts} ${width},${height}`;
  };

  return (
    <div className="min-h-screen bg-[#0d0f12] text-[#f0f2f5] font-sans antialiased flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300">
      
      {/* Top Navigation / Status Bar */}
      <header className="border-b border-gray-800 bg-[#12161a] px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-yellow-500 to-amber-600 p-2 rounded-lg text-black font-extrabold shadow-lg shadow-yellow-500/10">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              BINANCE FUTURES <span className="text-yellow-500 font-semibold text-sm px-2 py-0.5 bg-yellow-500/10 rounded border border-yellow-500/20">BOT DESK</span>
            </h1>
            <p className="text-xs text-gray-400">Simulation Terminal & Git Setup Assistant</p>
          </div>
        </div>

        {/* Live Ticker & State */}
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3 px-4 py-1.5 bg-[#1a1f26] rounded-lg border border-gray-800">
            <span className="text-xs text-gray-400 font-mono">BTCUSDT</span>
            <div className={`flex items-center font-mono font-bold text-base transition-colors duration-300 ${
              lastDirection === "up" ? "text-emerald-400" : lastDirection === "down" ? "text-rose-400" : "text-gray-300"
            }`}>
              ${marketState.currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {lastDirection === "up" ? (
                <ArrowUpRight className="w-4 h-4 ml-1 animate-bounce" />
              ) : lastDirection === "down" ? (
                <ArrowDownRight className="w-4 h-4 ml-1 animate-bounce" />
              ) : null}
            </div>
          </div>

          {/* Active Trading Mode Switcher */}
          <div className="flex items-center gap-3 bg-[#1a1f26] px-3 py-1.5 rounded-lg border border-gray-800">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 font-medium">Trading Mode:</span>
              <div className="flex p-0.5 bg-[#0f1216] rounded-md border border-gray-800/85">
                <button
                  type="button"
                  onClick={() => handleToggleMode("SIMULATION")}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all uppercase ${
                    marketState.activeTradingMode === "SIMULATION"
                      ? "bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm font-semibold"
                      : "text-gray-400 hover:text-gray-200 border border-transparent"
                  }`}
                >
                  Simulation
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleMode("LIVE")}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all uppercase flex items-center gap-1 ${
                    marketState.activeTradingMode === "LIVE"
                      ? "bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25 shadow-sm font-semibold"
                      : "text-gray-400 hover:text-gray-200 border border-transparent"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${marketState.apiConfigured ? "bg-[#10b981] animate-pulse" : "bg-gray-500"}`}></span>
                  Live Testnet
                </button>
              </div>
            </div>

            {/* API Config Button */}
            <button
              type="button"
              onClick={() => {
                setApiKeyInput("");
                setApiSecretInput("");
                setTestResult(null);
                setIsConfigModalOpen(true);
              }}
              className={`py-1 px-2.5 rounded border transition-all flex items-center gap-1.5 ${
                marketState.apiConfigured 
                  ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10" 
                  : "bg-gray-850 text-gray-300 border-gray-800 hover:bg-gray-800 hover:text-white"
              }`}
              title="Configure Testnet API Keys"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold tracking-wider uppercase">
                {marketState.apiConfigured ? "API Keys Active" : "Set API Keys"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto w-full">
        
        {/* Left Column: Order Placement Entry (lg:col-span-4) */}
        <div id="gui-order-terminal" className="lg:col-span-4 bg-[#12161a] rounded-xl border border-gray-800 p-5 flex flex-col shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-yellow-500" />
              <h2 className="text-sm font-semibold tracking-wide uppercase text-white">Order Terminal</h2>
            </div>
            <span className="text-[10px] font-mono text-gray-500 bg-gray-900 px-2 py-0.5 rounded border border-gray-800">
              Manual GUI Entry
            </span>
          </div>

          {/* Sell/Buy Tab Buttons */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setSide("BUY")}
              className={`py-2 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-200 border ${
                side === "BUY"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-md shadow-emerald-500/5"
                  : "bg-[#181d24] text-gray-400 border-transparent hover:text-gray-300"
              }`}
            >
              Buy / Long
            </button>
            <button
              onClick={() => setSide("SELL")}
              className={`py-2 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-200 border ${
                side === "SELL"
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-md shadow-rose-500/5"
                  : "bg-[#181d24] text-gray-400 border-transparent hover:text-gray-300"
              }`}
            >
              Sell / Short
            </button>
          </div>

          <form onSubmit={handlePlaceOrder} className="flex-1 flex flex-col gap-4">
            {/* Symbol Selection */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-1">Trading Pair</label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full bg-[#181d24] border border-gray-800 rounded-lg py-2 px-3 text-sm text-white font-mono focus:outline-none focus:border-yellow-500"
              >
                <option value="BTCUSDT">BTCUSDT (Bitcoin)</option>
                <option value="ETHUSDT">ETHUSDT (Ethereum)</option>
                <option value="SOLUSDT">SOLUSDT (Solana)</option>
              </select>
            </div>

            {/* Order Type Selector */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-1">Order Type</label>
              <div className="grid grid-cols-3 gap-1 bg-[#181d24] p-1 rounded-lg border border-gray-800">
                {(["MARKET", "LIMIT", "STOP_LIMIT"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setOrderType(t)}
                    className={`py-1.5 px-2 text-[10px] font-bold rounded-md transition-all uppercase ${
                      orderType === t
                        ? "bg-[#222933] text-yellow-500 shadow-sm"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {t.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Inputs Container */}
            <div className="grid grid-cols-1 gap-3 p-3 bg-[#181d24] rounded-lg border border-gray-800/60">
              
              {/* Quantity */}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1 flex justify-between">
                  <span>Quantity</span>
                  <span className="text-gray-500">Min 0.001</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-[#0d1013] border border-gray-800 rounded-md py-1.5 pl-3 pr-10 text-sm font-mono text-white focus:outline-none focus:border-yellow-500"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-gray-500 font-mono">
                    BTC
                  </div>
                </div>
              </div>

              {/* Price (Limit Price) */}
              {orderType !== "MARKET" && (
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1">
                    Limit Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-[#0d1013] border border-gray-800 rounded-md py-1.5 px-3 text-sm font-mono text-white focus:outline-none focus:border-yellow-500"
                  />
                </div>
              )}

              {/* Stop Price (Trigger Price) - ONLY for STOP_LIMIT */}
              {orderType === "STOP_LIMIT" && (
                <div className="border-t border-gray-800/80 pt-2.5 mt-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="px-1.5 py-0.5 text-[8px] font-extrabold bg-amber-500/10 text-amber-500 rounded border border-amber-500/20 uppercase tracking-wide">
                      Bonus Feature
                    </span>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-300">
                      Stop Price ($)
                    </label>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={stopPrice}
                    onChange={(e) => setStopPrice(e.target.value)}
                    className="w-full bg-[#0d1013] border border-amber-500/20 rounded-md py-1.5 px-3 text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                    Maps directly to Binance Futures' native <code className="text-gray-300 font-mono bg-[#0d1013] px-1 rounded">STOP</code> order type internally.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Balance sliders */}
            <div className="flex justify-between items-center gap-1.5 text-[10px] text-gray-500">
              <span className="font-mono">Est. Value:</span>
              <span className="font-mono text-gray-300">
                ${Number((parseFloat(quantity || "0") * (orderType !== "MARKET" ? parseFloat(price || "0") : marketState.currentPrice)).toFixed(2)) || "0.00"}
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className={`w-full py-3 px-4 rounded-lg font-bold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-lg mt-auto ${
                side === "BUY"
                  ? "bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/10 hover:shadow-emerald-500/20"
                  : "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/10 hover:shadow-rose-500/20"
              }`}
            >
              Place {side === "BUY" ? "BUY / LONG" : "SELL / SHORT"} Order
            </button>

            {orderStatusMessage && (
              <div className={`mt-3 p-3 rounded-lg border text-xs font-mono flex items-start gap-2 animate-pulse ${
                orderStatusMessage.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : orderStatusMessage.type === "error"
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                  : "bg-blue-500/10 border-blue-500/20 text-blue-400"
              }`}>
                {orderStatusMessage.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <Info className="w-4 h-4 shrink-0 mt-0.5" />}
                <span>{orderStatusMessage.text}</span>
              </div>
            )}
          </form>

          {/* Simulation mode info block */}
          <div className="mt-4 p-3 bg-[#181d24]/60 border border-gray-800 rounded-lg text-[11px] text-gray-400 leading-relaxed">
            <div className="flex gap-2 items-start">
              <Info className="w-4 h-4 text-yellow-500 shrink-0" />
              <div>
                <span className="font-semibold text-gray-200">Tip:</span> Set keys in <code className="text-yellow-500 font-mono">.env</code> to trade on real Testnet. Currently running in <span className="text-yellow-500">Local Sandbox Mode</span>. Place orders here or run CLI commands in the center terminal.
              </div>
            </div>
          </div>
        </div>

        {/* Center/Right Section: Live Chart, Terminal Emulator, Monitor (lg:col-span-8) */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* Top of Workspace: Live Chart & Terminal Preset Rows */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Live Interactive SVG Chart (md:col-span-7) */}
            <div className="md:col-span-7 bg-[#12161a] border border-gray-800 rounded-xl p-5 shadow-xl flex flex-col h-[230px]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-white">Live Price Feed Tracker</span>
                </div>
                <div className="text-[11px] text-gray-500 font-mono">
                  BTCUSDT (Last 30 ticks)
                </div>
              </div>

              {/* Live Mini Chart */}
              <div className="flex-1 bg-[#0d0f12] rounded-lg border border-gray-800 relative overflow-hidden flex items-end">
                {priceHistory.length > 1 ? (
                  <svg className="w-full h-full" viewBox="0 0 500 150" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    
                    {/* Grid Lines */}
                    <line x1="0" y1="37" x2="500" y2="37" stroke="#1f2937" strokeWidth="0.5" strokeDasharray="3" />
                    <line x1="0" y1="75" x2="500" y2="75" stroke="#1f2937" strokeWidth="0.5" strokeDasharray="3" />
                    <line x1="0" y1="112" x2="500" y2="112" stroke="#1f2937" strokeWidth="0.5" strokeDasharray="3" />

                    {/* Gradient Area */}
                    <polygon
                      points={renderChartAreaPoints()}
                      fill="url(#chartGradient)"
                    />
                    {/* Line path */}
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      points={renderChartPoints()}
                    />
                  </svg>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 font-mono">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Initializing Chart Streams...
                  </div>
                )}
                {/* Float current price indicator */}
                <div className="absolute right-3 top-3 bg-[#12161a]/90 backdrop-blur border border-emerald-500/20 px-2 py-1 rounded text-xs font-mono font-bold text-emerald-400">
                  ${marketState.currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Portfolio Monitor (md:col-span-5) */}
            <div className="md:col-span-5 bg-[#12161a] border border-gray-800 rounded-xl p-5 shadow-xl flex flex-col justify-between h-[230px]">
              <div>
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-800">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white">Balances & Positions</span>
                  <span className="text-[10px] font-mono text-gray-500">Margin Asset: USDT</span>
                </div>

                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs text-gray-400">Wallet Balance:</span>
                  <span className="text-sm font-mono font-bold text-white">
                    ${marketState.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-[#181d24] border border-gray-800/80 rounded-lg p-2.5">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-gray-400">Position Side:</span>
                    <span className={`font-bold font-mono text-[11px] px-2 py-0.5 rounded ${
                      marketState.position.side === "LONG"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : marketState.position.side === "SHORT"
                        ? "bg-rose-500/10 text-rose-400"
                        : "bg-gray-800 text-gray-500"
                    }`}>
                      {marketState.position.side === "NONE" ? "NO POSITION" : marketState.position.side}
                    </span>
                  </div>

                  {marketState.position.side !== "NONE" && (
                    <div className="space-y-1 text-[11px] font-mono mt-2 pt-2 border-t border-gray-800">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Size:</span>
                        <span className="text-gray-300">{marketState.position.quantity} BTC</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Entry Price:</span>
                        <span className="text-gray-300">${marketState.position.entryPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Unrealized PnL:</span>
                        <span className={`font-bold ${marketState.position.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {marketState.position.pnl >= 0 ? "+" : ""}${marketState.position.pnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {marketState.position.side !== "NONE" ? (
                <button
                  onClick={handleClosePosition}
                  className="w-full bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400 font-semibold text-xs py-2 rounded-lg transition-all duration-200 uppercase mt-2 cursor-pointer"
                >
                  Market Close Position
                </button>
              ) : (
                <div className="text-center text-[10px] text-gray-500 italic mt-2 py-2">
                  No active leverage positions open
                </div>
              )}
            </div>
          </div>

          {/* Interactive Bash Terminal CLI Emulator */}
          <div className="bg-[#0b0d10] border border-gray-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[320px]">
            {/* Terminal Header */}
            <div className="bg-[#12161a] border-b border-gray-800 px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TerminalIcon className="w-4 h-4 text-yellow-500" />
                <span className="text-xs font-semibold text-gray-300 font-mono">Interactive Python CLI Terminal</span>
              </div>
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500/80"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500/80"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
              </div>
            </div>

            {/* Quick Command Presets */}
            <div className="bg-[#151920] px-4 py-2 border-b border-gray-800/60 flex flex-wrap gap-2 items-center">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider font-mono mr-1">CLI Presets:</span>
              {terminalPresets.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setTerminalInput(preset.cmd);
                    executeTerminalCommand(preset.cmd);
                  }}
                  className="bg-[#1e2530] hover:bg-[#283140] border border-gray-800 rounded px-2.5 py-1 text-[10px] font-mono text-yellow-400 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Play className="w-2.5 h-2.5 fill-current shrink-0" />
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Output History Screen */}
            <div className="flex-1 p-4 overflow-y-auto font-mono text-[12px] text-gray-300 space-y-1.5 scrollbar-thin scrollbar-thumb-gray-800">
              {terminalHistory.map((line, idx) => (
                <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                  {line.startsWith("bot@terminal:~$") ? (
                    <span className="text-emerald-400 font-bold">{line}</span>
                  ) : line.includes("ERROR") || line.includes("Error:") ? (
                    <span className="text-rose-400">{line}</span>
                  ) : line.includes("SUCCESS") || line.includes("successfully") ? (
                    <span className="text-emerald-300">{line}</span>
                  ) : line.startsWith("Usage:") ? (
                    <span className="text-gray-400 italic">{line}</span>
                  ) : (
                    line
                  )}
                </div>
              ))}
              <div ref={terminalBottomRef} />
            </div>

            {/* Terminal Input Line */}
            <form onSubmit={handleTerminalSubmit} className="bg-[#12161a] border-t border-gray-800 p-2.5 flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-emerald-400" />
              <input
                type="text"
                placeholder="Type command here (e.g. python cli.py --side BUY --type LIMIT --quantity 0.01 --price 60000)..."
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                className="flex-1 bg-transparent border-none text-white font-mono text-xs focus:outline-none placeholder-gray-600"
              />
              <button
                type="submit"
                className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold text-xs rounded transition-colors font-mono uppercase tracking-wide cursor-pointer"
              >
                Execute
              </button>
            </form>
          </div>

          {/* Active Pending Orders Table */}
          <div className="bg-[#12161a] border border-gray-800 rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-white">Active Pending Simulated Orders</h3>
              </div>
              <span className="text-[10px] font-mono text-gray-400">
                Pending Trigger or execution
              </span>
            </div>

            {marketState.orders.filter(o => o.status === "NEW" || o.status === "TRIGGERED").length === 0 ? (
              <div className="text-center text-xs text-gray-500 py-6 italic font-mono">
                No active pending orders. Create a LIMIT or STOP_LIMIT order.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-gray-800/80 text-gray-500">
                      <th className="pb-2">Order ID</th>
                      <th className="pb-2">Symbol</th>
                      <th className="pb-2">Side</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Qty</th>
                      <th className="pb-2">Limit Price</th>
                      <th className="pb-2">Stop Price</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketState.orders
                      .filter(o => o.status === "NEW" || o.status === "TRIGGERED")
                      .map((o) => (
                        <tr key={o.id} className="border-b border-gray-800/40 text-gray-300 hover:bg-gray-900/40">
                          <td className="py-2.5 text-gray-500">{o.id}</td>
                          <td className="py-2.5 font-bold text-white">{o.symbol}</td>
                          <td className="py-2.5">
                            <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                              o.side === "BUY" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                            }`}>
                              {o.side}
                            </span>
                          </td>
                          <td className="py-2.5 font-semibold text-amber-500">{o.type}</td>
                          <td className="py-2.5">{o.quantity}</td>
                          <td className="py-2.5">${o.price?.toLocaleString() || "-"}</td>
                          <td className="py-2.5 text-amber-500 font-semibold">${o.stopPrice?.toLocaleString() || "-"}</td>
                          <td className="py-2.5">
                            <span className="text-[10px] text-yellow-500 uppercase tracking-wide px-1.5 py-0.5 bg-yellow-500/10 rounded border border-yellow-500/20">
                              {o.status}
                            </span>
                          </td>
                          <td className="py-2 text-right">
                            <button
                              onClick={() => handleCancelOrder(o.id)}
                              className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded text-[10px] font-bold cursor-pointer transition-all"
                            >
                              Cancel
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bottom Tabs Section: Logs/Git Repository manager */}
          <div className="bg-[#12161a] border border-gray-800 rounded-xl overflow-hidden shadow-xl">
            {/* Tabs Selector Header */}
            <div className="bg-[#181d24] border-b border-gray-800 flex items-center justify-between px-2">
              <div className="flex">
                <button
                  onClick={() => setActiveTab("logs")}
                  className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 cursor-pointer transition-all uppercase tracking-wider ${
                    activeTab === "logs"
                      ? "border-yellow-500 text-yellow-500 bg-[#12161a]"
                      : "border-transparent text-gray-400 hover:text-white"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  logs/bot.log Stream
                </button>
                <button
                  onClick={() => setActiveTab("git")}
                  className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 cursor-pointer transition-all uppercase tracking-wider ${
                    activeTab === "git"
                      ? "border-yellow-500 text-yellow-500 bg-[#12161a]"
                      : "border-transparent text-gray-400 hover:text-white"
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  Git Repository Setup
                </button>
                <button
                  onClick={() => setActiveTab("python")}
                  className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 cursor-pointer transition-all uppercase tracking-wider ${
                    activeTab === "python"
                      ? "border-yellow-500 text-yellow-500 bg-[#12161a]"
                      : "border-transparent text-gray-400 hover:text-white"
                  }`}
                >
                  <Github className="w-3.5 h-3.5" />
                  Python Code viewer
                </button>
              </div>

              {activeTab === "logs" && (
                <button
                  onClick={handleClearLogs}
                  className="px-2.5 py-1 text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 rounded text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 cursor-pointer mr-3 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Clear Log File
                </button>
              )}
            </div>

            {/* Tab 1: Live log file reader */}
            {activeTab === "logs" && (
              <div className="p-4 bg-[#0d0f12]">
                <div className="bg-[#0b0d10] border border-gray-800 rounded-lg p-3 h-[250px] overflow-y-auto font-mono text-[11px] text-gray-400 space-y-1 scrollbar-thin scrollbar-thumb-gray-800">
                  {logs.map((logLine, idx) => (
                    <div key={idx} className="hover:bg-gray-900/30 py-0.5 rounded px-1">
                      {logLine.includes("INFO") ? (
                        <span className="text-blue-400 font-semibold">{logLine.substring(0, 23)}</span>
                      ) : logLine.includes("ERROR") ? (
                        <span className="text-rose-500 font-semibold">{logLine.substring(0, 23)}</span>
                      ) : (
                        <span className="text-gray-500">{logLine.substring(0, 23)}</span>
                      )}
                      <span className="text-gray-300 ml-2">{logLine.substring(23)}</span>
                    </div>
                  ))}
                  <div ref={logsBottomRef} />
                </div>
              </div>
            )}

            {/* Tab 2: Git Repository Setup Visualizer */}
            {activeTab === "git" && (
              <div className="p-5 space-y-5">
                <div className="bg-[#181d24] border border-gray-800 rounded-lg p-4 flex gap-3 items-start">
                  <Info className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-300 leading-relaxed space-y-1">
                    <p className="font-bold text-white">Repository Initialized Successfully!</p>
                    <p>
                      A git repository has been initialized inside the project folder. A pristine <code className="text-yellow-500 font-mono">.gitignore</code> excludes log dumps (<code className="text-gray-400 font-mono">logs/</code>), environment states (<code className="text-gray-400 font-mono">.env</code>), and build files (<code className="text-gray-400 font-mono">dist/</code>).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">Push to Your GitHub:</h4>
                    <div className="bg-[#0d0f12] border border-gray-800 rounded-lg p-3 font-mono text-[11px] text-gray-300 space-y-1 relative">
                      <button
                        onClick={() => copyToClipboard("git remote add origin https://github.com/YOUR_USERNAME/trading-bot.git\ngit branch -M main\ngit push -u origin main")}
                        className="absolute right-2 top-2 bg-[#1e2530] hover:bg-[#283140] text-gray-400 p-1.5 rounded transition-all cursor-pointer"
                        title="Copy Commands"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <p className="text-gray-500"># Navigate to project</p>
                      <p className="text-yellow-500">cd trading_bot</p>
                      <p className="text-gray-500"># Link your remote repository</p>
                      <p className="text-emerald-400">git remote add origin https://github.com/YOUR_USERNAME/trading-bot.git</p>
                      <p className="text-emerald-400">git branch -M main</p>
                      <p className="text-gray-500"># Push code</p>
                      <p className="text-emerald-400">git push -u origin main</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">Commit History logs:</h4>
                    <div className="border-l border-gray-800 ml-3.5 pl-4 space-y-4">
                      <div className="relative">
                        <span className="absolute -left-[23px] top-1 bg-yellow-500 w-2.5 h-2.5 rounded-full border border-[#12161a]"></span>
                        <p className="text-xs font-bold text-white flex items-center gap-2">
                          feat: Add Stop-Limit bonus order support
                          <span className="text-[9px] font-mono bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-1 rounded">HEAD</span>
                        </p>
                        <p className="text-[10px] text-gray-500 font-mono">6a7b1c3 - 2 minutes ago</p>
                      </div>
                      <div className="relative">
                        <span className="absolute -left-[23px] top-1 bg-gray-600 w-2.5 h-2.5 rounded-full border border-[#12161a]"></span>
                        <p className="text-xs font-semibold text-gray-400">initial commit with repository files</p>
                        <p className="text-[10px] text-gray-500 font-mono">3f4e2d1 - 10 minutes ago</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Python Code Viewers */}
            {activeTab === "python" && (
              <div className="p-4 bg-[#0d0f12] space-y-4">
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-[#1e2530] text-yellow-500 font-mono text-xs rounded border border-gray-800">
                    cli.py
                  </span>
                  <span className="px-3 py-1 bg-[#12161a] text-gray-400 font-mono text-xs rounded">
                    orders.py
                  </span>
                </div>
                <div className="bg-[#0b0d10] border border-gray-800 rounded-lg p-3 h-[250px] overflow-y-auto font-mono text-[11px] text-gray-400">
                  <pre className="text-gray-300">
{`#!/usr/bin/env python3
import argparse
import sys
try:
    from bot.orders import place_order
except ImportError:
    from orders import place_order

def main():
    parser = argparse.ArgumentParser(description="Binance Futures Trading Bot CLI")
    parser.add_argument("--symbol", type=str, default="BTCUSDT")
    parser.add_argument("--side", type=str, required=True, choices=["BUY", "SELL"])
    parser.add_argument("--type", type=str, required=True, choices=["MARKET", "LIMIT", "STOP_LIMIT"])
    parser.add_argument("--quantity", type=float, required=True)
    parser.add_argument("--price", type=float)
    parser.add_argument("--stop-price", type=float)

    args = parser.parse_args()
    ...`}
                  </pre>
                  <p className="text-[10px] text-gray-500 mt-4 italic text-center">
                    (Full functional python files exist in the project directory ready to be executed or downloaded!)
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* API Key Configuration Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#12161a] border border-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-[#181d24] border-b border-gray-800 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-yellow-500" />
                <h3 className="font-bold text-white text-base">API Configuration</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="text-gray-400 hover:text-white text-lg transition-colors"
                disabled={isTesting}
              >
                &times;
              </button>
            </div>

            {/* Content / Form */}
            <form onSubmit={handleTestAndSave} className="p-5 space-y-4">
              <div className="bg-[#1e2530]/50 border border-yellow-500/10 rounded-lg p-3.5 flex gap-2.5">
                <Info className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <div className="text-xs text-gray-300 leading-relaxed">
                  <p className="font-semibold text-white mb-0.5">Binance Futures Testnet API Key Required</p>
                  <p>
                    Trading mode requires a valid key/secret pair from the{" "}
                    <a
                      href="https://testnet.binancefuture.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-yellow-500 underline hover:text-yellow-400 font-semibold"
                    >
                      Binance Futures Testnet
                    </a>. Your keys will be validated and saved securely in your server configuration.
                  </p>
                </div>
              </div>

              {/* API Key input */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-gray-400 mb-1">
                  Testnet API Key
                </label>
                <input
                  type={showKeys ? "text" : "password"}
                  required
                  placeholder="Enter your Testnet API Key"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full bg-[#0d1013] border border-gray-800 rounded-lg py-2 px-3 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                  disabled={isTesting}
                />
              </div>

              {/* API Secret input */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-gray-400 mb-1">
                  Testnet API Secret
                </label>
                <input
                  type={showKeys ? "text" : "password"}
                  required
                  placeholder="Enter your Testnet API Secret"
                  value={apiSecretInput}
                  onChange={(e) => setApiSecretInput(e.target.value)}
                  className="w-full bg-[#0d1013] border border-gray-800 rounded-lg py-2 px-3 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                  disabled={isTesting}
                />
              </div>

              {/* Show/Hide Keys Checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showKeysCheckbox"
                  checked={showKeys}
                  onChange={(e) => setShowKeys(e.target.checked)}
                  className="rounded border-gray-850 bg-gray-900 text-yellow-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                />
                <label htmlFor="showKeysCheckbox" className="text-xs text-gray-400 cursor-pointer select-none">
                  Show credentials in plain text
                </label>
              </div>

              {/* Test Results Banner */}
              {testResult && (
                <div
                  className={`p-3 rounded-lg border text-xs leading-relaxed flex items-start gap-2.5 ${
                    testResult.success
                      ? "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-4 py-2 bg-transparent text-gray-400 hover:text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition-all"
                  disabled={isTesting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTesting}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-800 text-black font-bold rounded-lg text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    "Test & Save Keys"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Footer copyright */}
      <footer className="border-t border-gray-800 bg-[#0b0d10] py-4 text-center text-xs text-gray-500 font-mono">
        &copy; 2026 Binance Futures Order Terminal &bull; Created with Google AI Studio
      </footer>
    </div>
  );
}
