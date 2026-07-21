#!/usr/bin/env python3
"""
Orders execution handler for Binance Futures API.
"""

import os
import hmac
import hashlib
import time
import urllib.parse
import urllib.request
import json
import logging
from pathlib import Path

# Setup logging
log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)
log_file = log_dir / "bot.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - bot - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(str(log_file)),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("bot")

def load_env():
    """Simple loader for .env file if present."""
    if os.path.exists(".env"):
        with open(".env", "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    # Strip quotes
                    val = val.strip().strip('"').strip("'")
                    os.environ[key.strip()] = val

# Load local environment variables
load_env()

BINANCE_API_KEY = os.getenv("BINANCE_API_KEY")
BINANCE_API_SECRET = os.getenv("BINANCE_API_SECRET")

# Use Futures Testnet by default, or live if specified
USE_TESTNET = os.getenv("USE_LIVE_API") != "true"
BASE_URL = "https://testnet.binancefuture.com" if USE_TESTNET else "https://fapi.binance.com"

def generate_signature(query_string, secret):
    return hmac.new(
        secret.encode('utf-8'),
        query_string.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

def place_order(symbol, side, order_type, quantity, price=None, stop_price=None):
    symbol = symbol.upper()
    side = side.upper()
    
    # Map CLI Order Types to Binance API Order Types
    # Binance Futures native STOP type is used for stop-limit orders
    binance_type = order_type
    if order_type == "STOP_LIMIT":
        binance_type = "STOP"

    logger.info(
        f"Placing order: Symbol={symbol}, Side={side}, Type={order_type} "
        f"(Mapped to {binance_type}), Qty={quantity}, Price={price}, StopPrice={stop_price}"
    )

    # If API keys are not set, run in Simulation mode
    if not BINANCE_API_KEY or BINANCE_API_KEY.startswith("MY_GEMINI_API") or BINANCE_API_KEY == "MY_BINANCE_API_KEY":
        # Generate fake order ID
        simulated_order_id = int(time.time() * 100)
        logger.info(f"[SIMULATION] Order placement simulated successfully!")
        logger.info(
            f"[SIMULATION] RESULT - Symbol: {symbol}, Side: {side}, Type: {order_type}, "
            f"Qty: {quantity}, Price: {price or 'MARKET'}, StopPrice: {stop_price or 'NONE'}, "
            f"OrderId: {simulated_order_id}, Status: NEW"
        )
        return True

    # Real Binance Futures API order execution
    timestamp = int(time.time() * 1000)
    params = {
        "symbol": symbol,
        "side": side,
        "type": binance_type,
        "quantity": str(quantity),
        "timestamp": timestamp,
    }

    if binance_type == "LIMIT":
        params["price"] = str(price)
        params["timeInForce"] = "GTC"
    elif binance_type == "STOP":
        params["price"] = str(price)
        params["stopPrice"] = str(stop_price)
        params["timeInForce"] = "GTC"

    query_string = urllib.parse.urlencode(params)
    signature = generate_signature(query_string, BINANCE_API_SECRET)
    full_url = f"{BASE_URL}/fapi/v1/order?{query_string}&signature={signature}"

    req = urllib.request.Request(full_url, method="POST")
    req.add_header("X-MBX-APIKEY", BINANCE_API_KEY)
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            res_data = json.loads(res_body)
            
            order_id = res_data.get("orderId")
            status = res_data.get("status", "NEW")
            logger.info(
                f"[SUCCESS] Order Placed on Binance. OrderId: {order_id}, Status: {status}"
            )
            return True
            
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        logger.error(f"[ERROR] Failed to place Binance order: HTTP {e.code} - {err_msg}")
        return False
    except Exception as e:
        logger.error(f"[ERROR] Unexpected error executing order: {str(e)}")
        return False
