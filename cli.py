#!/usr/bin/env python3
"""
Trading Bot CLI
Usage:
    python cli.py --symbol BTCUSDT --side SELL --type STOP_LIMIT --quantity 0.01 --price 59000 --stop-price 59500
"""

import argparse
import sys
try:
    from bot.orders import place_order
except ImportError:
    from orders import place_order

def main():
    parser = argparse.ArgumentParser(description="Binance Futures Trading Bot CLI")
    parser.add_argument("--symbol", type=str, default="BTCUSDT", help="Trading pair symbol (e.g., BTCUSDT)")
    parser.add_argument("--side", type=str, required=True, choices=["BUY", "SELL"], help="Order side")
    parser.add_argument("--type", type=str, required=True, choices=["MARKET", "LIMIT", "STOP_LIMIT"], help="Order type")
    parser.add_argument("--quantity", type=float, required=True, help="Quantity of asset to trade")
    parser.add_argument("--price", type=float, help="Limit price (required for LIMIT and STOP_LIMIT orders)")
    parser.add_argument("--stop-price", type=float, help="Stop price (required for STOP_LIMIT orders)")

    args = parser.parse_args()

    # Validate arguments based on order type
    if args.type == "LIMIT" and args.price is None:
        print("Error: --price is required for LIMIT orders.", file=sys.stderr)
        sys.exit(1)
        
    if args.type == "STOP_LIMIT":
        if args.price is None:
            print("Error: --price is required for STOP_LIMIT orders.", file=sys.stderr)
            sys.exit(1)
        if args.stop_price is None:
            print("Error: --stop-price is required for STOP_LIMIT orders.", file=sys.stderr)
            sys.exit(1)

    print(f"[*] Initializing order: {args.side} {args.quantity} {args.symbol} [Type: {args.type}]")
    
    success = place_order(
        symbol=args.symbol,
        side=args.side,
        order_type=args.type,
        quantity=args.quantity,
        price=args.price,
        stop_price=args.stop_price
    )
    
    if success:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
