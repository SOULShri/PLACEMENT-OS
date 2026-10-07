import { validatePDF } from '../pdf-validator';

describe('PDF Security Validator', () => {
  it('should pass validation for a clean mock PDF', () => {
    // Standard mock PDF header starts with '%PDF-1.5'
    const cleanBuffer = Buffer.from('%PDF-1.5\n%...\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
    const result = validatePDF(cleanBuffer, 'my_resume.pdf');

    expect(result.isValid).toBe(true);
    expect(result.isSanitary).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject a file with an invalid extension', () => {
    const buffer = Buffer.from('%PDF-1.5\n...');
    const result = validatePDF(buffer, 'my_resume.exe');

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('extension');
  });

  it('should reject a file with a mismatching magic number signature', () => {
    const buffer = Buffer.from('PNG_header_signature_data_here');
    const result = validatePDF(buffer, 'resume.pdf');

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('magic numbers');
  });

  it('should reject files exceeding the maximum size limit', () => {
    const cleanBuffer = Buffer.from('%PDF-1.5\n...');
    const result = validatePDF(cleanBuffer, 'large_resume.pdf', 10); // 10 bytes limit

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('size');
  });

  it('should flag a PDF containing active script execution objects', () => {
    // Embedded /JavaScript and /OpenAction objects
    const maliciousBuffer = Buffer.from('%PDF-1.5\n1 0 obj\n<< /OpenAction << /JS (app.alert("hack")) >> >>\nendobj\n%%EOF');
    const result = validatePDF(maliciousBuffer, 'exploit_resume.pdf');

    expect(result.isValid).toBe(true);
    expect(result.isSanitary).toBe(false);
    expect(result.activeFeaturesDetected).toContain('Auto-open Script Action');
    expect(result.error).toContain('scripting tags');
  });
});
