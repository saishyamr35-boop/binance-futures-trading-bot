from bot.logging_config import get_logger

logger = get_logger()

def validate_order_params(symbol, side, order_type, quantity, price=None, stop_price=None):
    """
    Validates Binance Futures order parameters.
    Returns:
        (bool, str): (True, "") if valid, or (False, error_msg) if invalid.
    """
    if not symbol:
        return False, "Symbol must be specified (e.g., BTCUSDT)"
        
    symbol_upper = symbol.upper()
    if not symbol_upper.endswith("USDT") and not symbol_upper.endswith("BUSD"):
        logger.warning(f"Symbol '{symbol}' might not be a standard USD-M Futures pair, proceeding anyway.")

    side_upper = side.upper()
    if side_upper not in ["BUY", "SELL"]:
        return False, f"Invalid side: {side}. Must be 'BUY' or 'SELL'."

    type_upper = order_type.upper()
    valid_types = ["MARKET", "LIMIT", "STOP", "STOP_LIMIT"]
    if type_upper not in valid_types:
        return False, f"Invalid order type: {order_type}. Must be one of {valid_types}."

    try:
        qty_float = float(quantity)
        if qty_float <= 0:
            return False, f"Quantity must be greater than zero. Received: {quantity}"
    except (ValueError, TypeError):
        return False, f"Quantity must be a valid number. Received: {quantity}"

    # Limit orders require price
    if type_upper == "LIMIT":
        if price is None:
            return False, "Price parameter is required for LIMIT orders."
        try:
            price_float = float(price)
            if price_float <= 0:
                return False, f"Price must be greater than zero for LIMIT orders. Received: {price}"
        except (ValueError, TypeError):
            return False, f"Price must be a valid number for LIMIT orders. Received: {price}"

    # Stop or Stop Limit orders require stop price
    if type_upper in ["STOP", "STOP_LIMIT"]:
        if stop_price is None:
            return False, f"Stop price is required for {type_upper} orders."
        try:
            stop_price_float = float(stop_price)
            if stop_price_float <= 0:
                return False, f"Stop price must be greater than zero. Received: {stop_price}"
        except (ValueError, TypeError):
            return False, f"Stop price must be a valid number. Received: {stop_price}"

    # STOP_LIMIT also requires price
    if type_upper == "STOP_LIMIT":
        if price is None:
            return False, "Price parameter is required for STOP_LIMIT orders."
        try:
            price_float = float(price)
            if price_float <= 0:
                return False, f"Price must be greater than zero. Received: {price}"
        except (ValueError, TypeError):
            return False, f"Price must be a valid number. Received: {price}"

    return True, ""
