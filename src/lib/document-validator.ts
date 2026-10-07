export interface DocumentValidationResult {
  isValid: boolean;
  error?: string;
  isSanitary: boolean;
  mimeType?: string;
}

export function validateDocument(
  fileBuffer: Buffer,
  fileName: string,
  maxSizeBytes = 10 * 1024 * 1024 // 10MB default
): DocumentValidationResult {
  // 1. Check size limit
  if (fileBuffer.length > maxSizeBytes) {
    return {
      isValid: false,
      isSanitary: false,
      error: `File size exceeds limit of ${maxSizeBytes / (1024 * 1024)}MB`,
    };
  }

  const nameLower = fileName.toLowerCase();
  
  // 2. Extension validation
  if (!nameLower.endsWith('.pdf') && !nameLower.endsWith('.docx')) {
    return {
      isValid: false,
      isSanitary: false,
      error: 'Unsupported file extension. Only .pdf and .docx are permitted.',
    };
  }

  // 3. Prevent executable header spoofing (MZ signature => 0x4D, 0x5A)
  if (fileBuffer[0] === 0x4D && fileBuffer[1] === 0x5A) {
    return {
      isValid: false,
      isSanitary: false,
      error: 'Security alert: Executable file signature (MZ) detected.',
    };
  }

  // 4. Validate specific signatures & content
  if (nameLower.endsWith('.pdf')) {
    // Check PDF magic number signature (%PDF- => 0x25, 0x50, 0x44, 0x46, 0x2d)
    if (
      fileBuffer[0] !== 0x25 ||
      fileBuffer[1] !== 0x50 ||
      fileBuffer[2] !== 0x44 ||
      fileBuffer[3] !== 0x46 ||
      fileBuffer[4] !== 0x2d
    ) {
      return {
        isValid: false,
        isSanitary: false,
        error: 'Invalid file signature: Header does not match standard PDF magic numbers.',
      };
    }

    // Active scripting scan inside PDF structures
    const fileContentString = fileBuffer.toString('binary');
    const dangerousPatterns = [
      { tag: '/JS', label: 'Embedded JavaScript Object' },
      { tag: '/JavaScript', label: 'Embedded JavaScript Command' },
      { tag: '/AA', label: 'Additional Action (Auto-exec)' },
      { tag: '/OpenAction', label: 'Auto-open Script Action' },
    ];

    const activeFeatures: string[] = [];
    dangerousPatterns.forEach((pattern) => {
      if (fileContentString.includes(pattern.tag)) {
        activeFeatures.push(pattern.label);
      }
    });

    if (activeFeatures.length > 0) {
      return {
        isValid: true,
        isSanitary: false,
        mimeType: 'application/pdf',
        error: 'Security alert: Embedded scripting tags detected inside the PDF structure.',
      };
    }

    return {
      isValid: true,
      isSanitary: true,
      mimeType: 'application/pdf',
    };
  } else if (nameLower.endsWith('.docx')) {
    // Check ZIP magic signature (PK => 0x50, 0x4B, 0x03, 0x04)
    if (
      fileBuffer[0] !== 0x50 ||
      fileBuffer[1] !== 0x4B ||
      fileBuffer[2] !== 0x03 ||
      fileBuffer[3] !== 0x04
    ) {
      return {
        isValid: false,
        isSanitary: false,
        error: 'Invalid file signature: Header does not match standard DOCX/ZIP signature.',
      };
    }

    // Scan binary structure to verify it contains valid DOCX XML content paths
    const fileContentString = fileBuffer.toString('binary');
    const hasContentTypes = fileContentString.includes('[Content_Types].xml');
    const hasWordDoc = fileContentString.includes('word/document.xml') || fileContentString.includes('word/');

    if (!hasContentTypes || !hasWordDoc) {
      return {
        isValid: false,
        isSanitary: false,
        error: 'Security alert: Renamed generic zip archive detected. Not a valid DOCX document.',
      };
    }

    return {
      isValid: true,
      isSanitary: true,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  return {
    isValid: false,
    isSanitary: false,
    error: 'Unknown validation state.',
  };
}
