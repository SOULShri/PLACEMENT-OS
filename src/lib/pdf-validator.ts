import { validateDocument } from './document-validator';

export function validatePDF(fileBuffer: Buffer, fileName: string, maxSizeBytes?: number) {
  const result = validateDocument(fileBuffer, fileName, maxSizeBytes);
  
  // Populate activeFeaturesDetected array for legacy tests compatibility
  const activeFeatures: string[] = [];
  if (fileName.toLowerCase().endsWith('.pdf')) {
    const fileContentString = fileBuffer.toString('binary');
    const dangerousPatterns = [
      { tag: '/JS', label: 'Embedded JavaScript Object' },
      { tag: '/JavaScript', label: 'Embedded JavaScript Command' },
      { tag: '/AA', label: 'Additional Action (Auto-exec)' },
      { tag: '/OpenAction', label: 'Auto-open Script Action' },
    ];
    dangerousPatterns.forEach((pattern) => {
      if (fileContentString.includes(pattern.tag)) {
        activeFeatures.push(pattern.label);
      }
    });
  }

  return {
    isValid: result.isValid,
    isSanitary: result.isSanitary,
    error: result.error,
    activeFeaturesDetected: activeFeatures,
  };
}
