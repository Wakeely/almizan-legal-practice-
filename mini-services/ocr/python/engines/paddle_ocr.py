"""
PaddleOCR-VL engine for document OCR.
Primary engine for Arabic and multilingual documents.
"""

import tempfile
import os
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class PaddleOCREngine:
    """PaddleOCR-VL based OCR engine."""
    
    def __init__(self):
        self._ocr = None
        self._initialized = False
    
    def _initialize(self):
        """Lazy initialization of PaddleOCR."""
        if self._initialized:
            return
        
        try:
            from paddleocr import PaddleOCR
            
            logger.info("Initializing PaddleOCR-VL...")
            self._ocr = PaddleOCR(
                use_angle_cls=True,
                lang='ar',  # Default to Arabic
                show_log=False,
                use_gpu=False  # Use CPU for now, GPU can be enabled later
            )
            self._initialized = True
            logger.info("PaddleOCR-VL initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize PaddleOCR: {e}")
            raise
    
    def is_available(self) -> bool:
        """Check if PaddleOCR is available."""
        try:
            import paddleocr
            return True
        except ImportError:
            return False
    
    def extract(self, content: bytes, filename: str, language: str = "ar") -> Dict[str, Any]:
        """
        Extract text using PaddleOCR.
        
        Args:
            content: Raw file bytes
            filename: Original filename
            language: Document language
            
        Returns:
            Dictionary with extracted text and metadata
        """
        self._initialize()
        
        # Determine language code for PaddleOCR
        lang_map = {
            "ar": "ar",
            "en": "en",
            "auto": "ar",  # Default to Arabic for Al Mizan
        }
        lang = lang_map.get(language, "ar")
        
        # Save to temporary file (PaddleOCR needs file path)
        ext = os.path.splitext(filename)[1] or ".png"
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            logger.info(f"Running PaddleOCR on {filename} (lang={lang})")
            
            # Run OCR
            result = self._ocr.ocr(tmp_path, cls=True)
            
            # Extract text from result
            text_parts = []
            page_count = 1
            
            if result and result[0]:
                for line in result[0]:
                    if line[1] and len(line[1]) > 0:
                        # line[1] is a tuple (text, confidence)
                        text = line[1][0] if isinstance(line[1], tuple) else line[1]
                        if text and text.strip():
                            text_parts.append(text.strip())
            
            full_text = "\n".join(text_parts)
            
            # Detect language from content (simple heuristic)
            detected_lang = language
            if any('\u0600' <= c <= '\u06FF' for c in full_text):
                detected_lang = "ar"
            elif any('A' <= c <= 'Z' or 'a' <= c <= 'z' for c in full_text):
                detected_lang = "en"
            
            logger.info(f"PaddleOCR extracted {len(full_text)} chars from {filename}")
            
            return {
                "text": full_text,
                "pages": page_count,
                "language": detected_lang
            }
            
        except Exception as e:
            logger.error(f"PaddleOCR extraction failed: {e}")
            raise
            
        finally:
            # Clean up temporary file
            try:
                os.unlink(tmp_path)
            except:
                pass
