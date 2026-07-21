#!/usr/bin/env python3
"""
Orders execution handler for Binance Futures API.
"""

import time
from bot.logging_config import get_logger
from bot.validators import validate_order_params
from bot.client import BinanceFuturesClient

logger = get_logger()

def place_order(symbol, side, order_type, quantity, price=None, stop_price=None):
    """
    Validates parameters and routes order placement either to simulation (if unconfigured)
    or directly to the real Binance Futures API client.
    """
    symbol = symbol.upper()
    side = side.upper()
    order_type = order_type.upper()

    # 1. Validate inputs
    is_valid, err_msg = validate_order_params(symbol, side, order_type, quantity, price, stop_price)
    if not is_valid:
        logger.error(f"[VALIDATION ERROR] {err_msg}")
        return False

    # Map CLI type STOP_LIMIT to Binance API native STOP type
    binance_type = order_type
    if order_type == "STOP_LIMIT":
        binance_type = "STOP"

    logger.info(
        f"Placing order: Symbol={symbol}, Side={side}, Type={order_type} "
        f"(Mapped to {binance_type}), Qty={quantity}, Price={price}, StopPrice={stop_price}"
    )

    client = BinanceFuturesClient()

    # 2. If client is not configured, run in Simulation mode
    if not client.is_configured():
        simulated_order_id = int(time.time() * 100)
        logger.info("[SIMULATION] Order placement simulated successfully!")
        logger.info(
            f"[SIMULATION] RESULT - Symbol: {symbol}, Side: {side}, Type: {order_type}, "
            f"Qty: {quantity}, Price: {price or 'MARKET'}, StopPrice: {stop_price or 'NONE'}, "
            f"OrderId: {simulated_order_id}, Status: NEW"
        )
        return True

    # 3. Real Binance API execution
    params = {
        "symbol": symbol,
        "side": side,
        "type": binance_type,
        "quantity": str(quantity),
    }

    if binance_type == "LIMIT":
        params["price"] = str(price)
        params["timeInForce"] = "GTC"
    elif binance_type == "STOP":
        params["price"] = str(price)
        params["stopPrice"] = str(stop_price)
        params["timeInForce"] = "GTC"

    try:
        res_data = client.send_signed_request("POST", "/fapi/v1/order", params)
        order_id = res_data.get("orderId")
        status = res_data.get("status", "NEW")
        logger.info(
            f"[SUCCESS] Order Placed on Binance. OrderId: {order_id}, Status: {status}"
        )
        return True
    except Exception as e:
        logger.error(f"[ERROR] Failed to execute Binance order: {str(e)}")
        return False
