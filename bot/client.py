import os
import hmac
import hashlib
import time
import urllib.parse
import urllib.request
import json
from bot.logging_config import get_logger

logger = get_logger()

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

# Pre-load local environment variables
load_env()

class BinanceFuturesClient:
    def __init__(self):
        # Refresh environment in case they are set after module load
        load_env()
        self.api_key = os.getenv("BINANCE_API_KEY")
        self.api_secret = os.getenv("BINANCE_API_SECRET")
        
        # Testnet vs Live URL Setup
        self.use_live = os.getenv("USE_LIVE_API") == "true"
        if self.use_live:
            self.base_url = "https://fapi.binance.com"
        else:
            self.base_url = "https://testnet.binancefuture.com"

    def is_configured(self):
        """Checks if valid credentials are set."""
        if not self.api_key or not self.api_secret:
            return False
        # Placeholders
        if self.api_key == "MY_BINANCE_API_KEY" or self.api_key.startswith("MY_GEMINI_API"):
            return False
        if "your_real_testnet" in self.api_key:
            return False
        return True

    def generate_signature(self, query_string):
        if not self.api_secret:
            return ""
        return hmac.new(
            self.api_secret.encode('utf-8'),
            query_string.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

    def send_signed_request(self, method, endpoint, params):
        """Sends a signed POST/GET request to Binance Futures."""
        if not self.is_configured():
            raise ValueError("Binance API credentials are not set or are invalid placeholder keys.")

        params["timestamp"] = int(time.time() * 1000)
        query_string = urllib.parse.urlencode(params)
        signature = self.generate_signature(query_string)
        
        full_url = f"{self.base_url}{endpoint}?{query_string}&signature={signature}"

        req = urllib.request.Request(full_url, method=method)
        req.add_header("X-MBX-APIKEY", self.api_key)
        req.add_header("Content-Type", "application/json")

        try:
            with urllib.request.urlopen(req) as response:
                res_body = response.read().decode("utf-8")
                return json.loads(res_body)
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8")
            logger.error(f"Binance API Request Failure: HTTP {e.code} - {err_msg}")
            raise Exception(f"Binance API returned HTTP {e.code}: {err_msg}")
        except Exception as e:
            logger.error(f"Binance client execution exception: {str(e)}")
            raise e
