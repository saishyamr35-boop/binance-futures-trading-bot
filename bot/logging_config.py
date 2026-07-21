import logging
from pathlib import Path

# Setup logging
log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)
log_file = log_dir / "bot.log"

# Define standard format
FORMAT = "%(asctime)s - bot - %(levelname)s - %(message)s"

# Configure root or specific logger
logger = logging.getLogger("bot")
logger.setLevel(logging.INFO)

# Avoid adding multiple handlers if already configured
if not logger.handlers:
    file_handler = logging.FileHandler(str(log_file))
    file_handler.setFormatter(logging.Formatter(FORMAT))
    logger.addHandler(file_handler)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(logging.Formatter(FORMAT))
    logger.addHandler(stream_handler)

def get_logger():
    return logger
