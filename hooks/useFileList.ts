// /hooks/useFileList.ts
// Simple hook to manage sent and received file lists.
// Keeps implementation beginner-friendly while centralising list logic.

import { useState, useCallback } from 'react';
import { FileItem } from '@/types/files';

export function useFileList() {
  const [sentFiles, setSentFiles] = useState<FileItem[]>([]);
  const [receivedFiles, setReceivedFiles] = useState<FileItem[]>([]);

  const addSentFile = useCallback((file: FileItem) => {
    setSentFiles(prev => [file, ...prev]);
  }, []);

  const addReceivedFile = useCallback((file: FileItem) => {
    setReceivedFiles(prev => {
      if (prev.some(f => f.fileId === file.fileId)) return prev;
      return [file, ...prev];
    });
  }, []);

  const findFileById = useCallback((fid: string): FileItem | undefined => {
    return [...sentFiles, ...receivedFiles].find(f => f.id.toString() === fid);
  }, [sentFiles, receivedFiles]);

  return {
    sentFiles,
    receivedFiles,
    addSentFile,
    addReceivedFile,
    findFileById,
  } as const;
}
