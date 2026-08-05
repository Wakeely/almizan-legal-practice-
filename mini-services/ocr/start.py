#!/usr/bin/env python3
"""
Al Mizan OCR Service - Entry Point
===================================
Starts the FastAPI server for OCR processing.
"""

import uvicorn
import os
import sys

def main():
    """Main entry point."""
    # Get configuration from environment
    host = os.environ.get("OCR_HOST", "0.0.0.0")
    port = int(os.environ.get("OCR_SERVICE_PORT", "8080"))
    log_level = os.environ.get("OCR_LOG_LEVEL", "info")
    
    print(f"🚀 Starting Al Mizan OCR Service on {host}:{port}")
    print(f"📦 Engines: PaddleOCR-VL (primary), Unlimited-OCR (future)")
    print(f"🌐 Language support: Arabic (priority), English")
    print()
    
    # Add current directory to Python path for imports
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
    
    # Start the FastAPI server
    uvicorn.run(
        "python.app:app",
        host=host,
        port=port,
        log_level=log_level,
        reload=False,  # Disable reload in production
        workers=1  # Single worker for now (PaddleOCR uses significant memory)
    )

if __name__ == "__main__":
    main()
