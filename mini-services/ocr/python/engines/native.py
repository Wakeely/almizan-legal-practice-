"""
Native text extraction for digital PDFs and DOCX files.
This avoids OCR when the document already contains selectable text.
"""

import io
import logging

logger = logging.getLogger(__name__)


def try_native_extract(content: bytes, filename: str) -> str | None:
    """
    Try to extract text natively from digital PDFs or DOCX files.
    
    Returns:
        Extracted text if successful, None if OCR is needed
    """
    filename_lower = filename.lower()
    
    # Try PDF extraction
    if filename_lower.endswith('.pdf'):
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=content, filetype="pdf")
            
            # Check if PDF has extractable text
            text_parts = []
            for page in doc:
                page_text = page.get_text()
                if page_text.strip():
                    text_parts.append(page_text)
            
            doc.close()
            
            # Only return if we got meaningful text
            full_text = "\n".join(text_parts).strip()
            if len(full_text) > 50:  # Minimum threshold for "real" text
                logger.info(f"Native PDF extraction successful: {len(full_text)} chars")
                return full_text
            
            logger.info("PDF has no extractable text, will use OCR")
            return None
            
        except Exception as e:
            logger.warning(f"Native PDF extraction failed: {e}")
            return None
    
    # Try DOCX extraction
    if filename_lower.endswith(('.docx', '.doc')):
        try:
            import mammoth
            result = mammoth.convert_to_text(io.BytesIO(content))
            
            text = result.value.strip()
            if len(text) > 50:  # Minimum threshold
                logger.info(f"Native DOCX extraction successful: {len(text)} chars")
                return text
            
            logger.info("DOCX has no extractable text, will use OCR")
            return None
            
        except Exception as e:
            logger.warning(f"Native DOCX extraction failed: {e}")
            return None
    
    # Try plain text extraction
    if filename_lower.endswith(('.txt', '.csv', '.json', '.md', '.rtf')):
        try:
            text = content.decode('utf-8')
            if text.strip():
                logger.info(f"Native text extraction successful: {len(text)} chars")
                return text
        except Exception as e:
            logger.warning(f"Text extraction failed: {e}")
    
    # For images and scanned PDFs, return None to trigger OCR
    return None
