"""
Al Mizan OCR Service
====================
Simple Python service for extracting text from legal documents.
Uses PaddleOCR-VL for Arabic documents (best accuracy).

Deployment options:
1. Railway (recommended) - free tier available
2. Render - free tier available
3. Any VPS with Python 3.12+

Environment variables:
- OCR_PORT: Port to run on (default: 8080)
- API_KEY: Optional API key for authentication
"""

import os
import io
import tempfile
import logging
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Al Mizan OCR Service",
    description="OCR service for Arabic legal documents",
    version="1.0.0"
)

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy-load OCR engine
_ocr_engine = None

def get_ocr():
    """Get or initialize PaddleOCR engine."""
    global _ocr_engine
    if _ocr_engine is None:
        logger.info("Initializing PaddleOCR-VL...")
        from paddleocr import PaddleOCR
        _ocr_engine = PaddleOCR(
            use_angle_cls=True,
            lang='ar',
            show_log=False,
            use_gpu=False
        )
        logger.info("PaddleOCR-VL initialized")
    return _ocr_engine

def extract_native_text(content: bytes, filename: str) -> Optional[str]:
    """Try native text extraction for digital PDFs/DOCX."""
    filename_lower = filename.lower()
    
    # PDF extraction
    if filename_lower.endswith('.pdf'):
        try:
            import fitz
            doc = fitz.open(stream=content, filetype="pdf")
            text_parts = []
            for page in doc:
                page_text = page.get_text()
                if page_text.strip():
                    text_parts.append(page_text)
            doc.close()
            full_text = "\n".join(text_parts).strip()
            if len(full_text) > 50:
                return full_text
        except Exception as e:
            logger.warning(f"PDF native extraction failed: {e}")
    
    # DOCX extraction
    if filename_lower.endswith(('.docx', '.doc')):
        try:
            import mammoth
            result = mammoth.convert_to_text(io.BytesIO(content))
            if result.value.strip() and len(result.value) > 50:
                return result.value
        except Exception as e:
            logger.warning(f"DOCX native extraction failed: {e}")
    
    return None

def extract_ocr_text(content: bytes, filename: str) -> str:
    """Extract text using PaddleOCR."""
    ocr = get_ocr()
    
    # Save to temp file
    ext = os.path.splitext(filename)[1] or ".png"
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        result = ocr.ocr(tmp_path, cls=True)
        text_parts = []
        
        if result and result[0]:
            for line in result[0]:
                if line[1] and len(line[1]) > 0:
                    text = line[1][0] if isinstance(line[1], tuple) else line[1]
                    if text and text.strip():
                        text_parts.append(text.strip())
        
        return "\n".join(text_parts)
    finally:
        os.unlink(tmp_path)

@app.get("/")
async def root():
    return {"service": "Al Mizan OCR", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "ok", "engine": "paddleocr-vl"}

@app.post("/ocr")
async def ocr_extract(
    file: UploadFile = File(...),
    language: str = Form("ar"),
    api_key: Optional[str] = Header(None),
):
    """
    Extract text from a document.
    
    - For digital PDFs/DOCX: extracts text directly (fast)
    - For scanned documents/images: uses OCR (slower but works)
    """
    # Check API key if configured
    required_key = os.environ.get("API_KEY")
    if required_key and api_key != required_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    try:
        content = await file.read()
        filename = file.filename or "document"
        
        logger.info(f"Processing: {filename} ({len(content)} bytes)")
        
        # Try native extraction first
        native_text = extract_native_text(content, filename)
        if native_text:
            return {
                "text": native_text,
                "engine": "native",
                "pages": 1
            }
        
        # Fall back to OCR
        ocr_text = extract_ocr_text(content, filename)
        return {
            "text": ocr_text,
            "engine": "paddleocr",
            "pages": 1
        }
        
    except Exception as e:
        logger.error(f"OCR failed: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("OCR_PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
