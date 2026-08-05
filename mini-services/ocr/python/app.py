"""
Al Mizan OCR Service
====================
FastAPI service providing OCR capabilities for legal documents.
Primary engine: PaddleOCR-VL (best for Arabic)
Secondary: Unlimited-OCR (future, for long English documents)
"""

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Al Mizan OCR Service",
    description="OCR service for Arabic and multilingual legal documents",
    version="1.0.0"
)

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy-load engines to avoid loading models at startup
_engine_cache = {}

def get_engine(engine_name: str):
    """Get or initialize an OCR engine."""
    if engine_name not in _engine_cache:
        if engine_name == "paddle":
            from engines.paddle_ocr import PaddleOCREngine
            _engine_cache[engine_name] = PaddleOCREngine()
        elif engine_name == "unlimited":
            from engines.unlimited_ocr import UnlimitedOCREngine
            _engine_cache[engine_name] = UnlimitedOCREngine()
        else:
            raise ValueError(f"Unknown engine: {engine_name}")
    return _engine_cache[engine_name]

def select_engine(engine: str, language: str) -> str:
    """Select the best engine based on request parameters."""
    if engine == "auto":
        # PaddleOCR is best for Arabic and general documents
        # Unlimited-OCR will be used for long English documents in the future
        if language in ["en"] and False:  # Placeholder for future Unlimited-OCR
            return "unlimited"
        return "paddle"
    return engine

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "ocr", "engines": ["paddle", "unlimited"]}

@app.post("/ocr")
async def ocr_extract(
    file: UploadFile = File(...),
    engine: str = Form("auto"),
    language: str = Form("ar"),
):
    """
    Extract text from a document using OCR.
    
    Args:
        file: The document file (PDF, image, DOCX, etc.)
        engine: OCR engine to use ("auto", "paddle", "unlimited")
        language: Document language ("ar", "en", "auto")
    
    Returns:
        JSON with extracted text, engine used, and page count
    """
    try:
        # Read file content
        content = await file.read()
        filename = file.filename or "unknown"
        
        logger.info(f"Processing file: {filename} ({len(content)} bytes)")
        
        # Try native extraction first (digital PDFs/DOCX without OCR)
        from engines.native import try_native_extract
        native_result = try_native_extract(content, filename)
        if native_result:
            logger.info(f"Native extraction successful for {filename}")
            return {
                "text": native_result,
                "engine_used": "native",
                "pages_processed": 1,
                "language_detected": language
            }
        
        # Select and use OCR engine
        engine_name = select_engine(engine, language)
        ocr_engine = get_engine(engine_name)
        
        logger.info(f"Using engine: {engine_name} for {filename}")
        result = ocr_engine.extract(content, filename, language)
        
        return {
            "text": result["text"],
            "engine_used": engine_name,
            "pages_processed": result.get("pages", 1),
            "language_detected": result.get("language", language)
        }
        
    except Exception as e:
        logger.error(f"OCR extraction failed: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": f"OCR extraction failed: {str(e)}"}
        )

@app.post("/ocr/batch")
async def ocr_batch_extract(
    files: list[UploadFile] = File(...),
    engine: str = Form("auto"),
    language: str = Form("ar"),
):
    """
    Extract text from multiple documents.
    
    Args:
        files: List of document files
        engine: OCR engine to use
        language: Document language
    
    Returns:
        JSON with results for each file
    """
    results = []
    
    for file in files:
        try:
            content = await file.read()
            filename = file.filename or "unknown"
            
            # Try native extraction first
            from engines.native import try_native_extract
            native_result = try_native_extract(content, filename)
            if native_result:
                results.append({
                    "filename": filename,
                    "text": native_result,
                    "engine_used": "native",
                    "pages_processed": 1,
                    "success": True
                })
                continue
            
            # Use OCR engine
            engine_name = select_engine(engine, language)
            ocr_engine = get_engine(engine_name)
            result = ocr_engine.extract(content, filename, language)
            
            results.append({
                "filename": filename,
                "text": result["text"],
                "engine_used": engine_name,
                "pages_processed": result.get("pages", 1),
                "success": True
            })
            
        except Exception as e:
            results.append({
                "filename": file.filename,
                "error": str(e),
                "success": False
            })
    
    return {"results": results}
