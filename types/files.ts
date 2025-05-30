// /types/files.ts
// Centralised shared types for file handling across contexts and hooks.
// Keeping these small and beginner-friendly.

export interface FileItem {
  id: number | string;
  name: string;
  size: number; // MB
  type: string;
  timestamp: string;
  fileId?: string;
  isEncrypted?: boolean;
  accessCondition?: string;
  isUploading?: boolean;
  progress?: number;
}

export interface UploadingFile {
  progress: number;
  name: string;
  size: number;
  type: string;
  timestamp?: string;
  isEncrypted?: boolean;
  accessCondition?: string;
}
