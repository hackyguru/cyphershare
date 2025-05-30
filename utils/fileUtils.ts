// /utils/fileUtils.ts
// Utility functions for file operations

import { FileItem } from '@/types/files';

/**
 * Prepares file metadata from a File object
 */
export function prepareFileMetadata(
  file: File, 
  id: string | number = Date.now(), 
  options: { isEncrypted?: boolean; accessCondition?: string } = {}
): FileItem {
  return {
    id,
    name: file.name,
    size: file.size / (1024 * 1024), // Convert to MB
    type: file.type || 'application/octet-stream',
    timestamp: new Date().toLocaleTimeString(),
    isEncrypted: options.isEncrypted,
    accessCondition: options.accessCondition,
  };
}

/**
 * Creates a Blob URL and triggers a download
 */
export function downloadFileFromBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copies text to clipboard with error handling
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Formats file size for display
 */
export function formatFileSize(sizeInMB: number): string {
  if (sizeInMB < 0.1) {
    return `${Math.round(sizeInMB * 1024)} KB`;
  } else if (sizeInMB < 1) {
    return `${sizeInMB.toFixed(1)} MB`;
  } else {
    return `${Math.round(sizeInMB)} MB`;
  }
}

/**
 * Gets the appropriate icon name based on file type
 */
export function getFileIconName(fileType: string): string {
  if (fileType.startsWith('image/')) return 'image';
  if (fileType.startsWith('video/')) return 'video';
  if (fileType.startsWith('audio/')) return 'audio';
  if (fileType.includes('pdf')) return 'pdf';
  if (fileType.includes('word') || fileType.includes('document')) return 'document';
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'spreadsheet';
  if (fileType.includes('zip') || fileType.includes('compressed')) return 'archive';
  return 'file'; // Default icon
}
