# Binance Futures Trading Bot

A high-performance Python-based CLI and interactive full-stack React trading terminal for Binance Futures.

## Features

- **Standard Order Types**: MARKET and LIMIT orders.
- **Stop-Limit Bonus Type**: Full implementation of STOP_LIMIT orders, which maps directly to Binance Futures' native `STOP` type.
- **Dual Execution Mode**:
  - **Live Mode**: Submits signed HMAC SHA256 requests to the Binance Futures Testnet or Production API.
  - **Simulation Mode**: Local sandbox environment for safe mock trades, order book visuals, and dynamic state rendering.
- **Log Archiver**: Outputs precise records with authentic order IDs to `logs/bot.log`.
- **Preloaded Git Repository**: Configured with a `.gitignore` and clean initial commits ready to be pushed.

---

## Installation & Setup

1. **Clone & Initialize**
   ```bash
   git init
   git add .
   git commit -m "feat: Add Stop-Limit bonus order support and trading terminal"
   ```

2. **Configure Credentials**
   Create a `.env` file in the root directory:
   ```env
   BINANCE_API_KEY="YOUR_API_KEY"
   BINANCE_API_SECRET="YOUR_API_SECRET"
   USE_LIVE_API="false" # Set to true to use Live fapi instead of Testnet fapi
   ```

3. **Running the CLI Bot**
   ```bash
   # Market Order
   python cli.py --symbol BTCUSDT --side BUY --type MARKET --quantity 0.01

   # Limit Order
   python cli.py --symbol BTCUSDT --side BUY --type LIMIT --quantity 0.01 --price 58500

   # Stop-Limit Order (Bonus)
   python cli.py --symbol BTCUSDT --side SELL --type STOP_LIMIT --quantity 0.01 --price 59000 --stop-price 59500
   ```

4. **Viewing Logs**
   Check `logs/bot.log` for execution logs and system states.
