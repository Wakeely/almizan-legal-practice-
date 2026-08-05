"""
Abstract base class for OCR engines.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any


class OCREngine(ABC):
    """Abstract base class for OCR engines."""
    
    @abstractmethod
    def extract(self, content: bytes, filename: str, language: str = "ar") -> Dict[str, Any]:
        """
        Extract text from a document.
        
        Args:
            content: Raw file bytes
            filename: Original filename (for format detection)
            language: Document language code
            
        Returns:
            Dictionary with keys:
                - text: Extracted text
                - pages: Number of pages processed (optional)
                - language: Detected language (optional)
        """
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if this engine is available and properly configured."""
        pass
