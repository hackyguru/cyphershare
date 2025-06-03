// components/files/FileRow.tsx
import { Button } from "@/components/ui/button";
import {
  Copy,
  Download,
  File,
  FileText,
  Image as ImageIcon,
  Eye,
  Loader2,
} from "lucide-react";
import { useFileTransfer } from "@/context/FileTransferContext";
import EncryptionBadge from "./EncryptionBadge";
import { FileItem } from "@/types/files";

interface FileRowProps {
  file: FileItem;
  onViewPyFile?: (file: FileItem) => void; // New prop
  isProcessingPyView?: boolean; // New prop
}

const getFileIcon = (type: string, name: string) => {
  if (name.endsWith(".py"))
    return (
      <FileText
        size={18}
        className="text-green-500 opacity-80 hover:opacity-100"
      />
    );
  if (type.startsWith("image")) return <ImageIcon size={18} />;
  if (type.includes("pdf")) return <FileText size={18} />;
  return <File size={18} />;
};

export const FileRow = ({
  file,
  onViewPyFile,
  isProcessingPyView,
}: FileRowProps) => {
  // Assuming useFileTransfer will be updated to expose decryptionInProgress if needed for download button
  const { copyFileCid, downloadFile, copySuccess /*, decryptionInProgress */ } =
    useFileTransfer();

  const handleViewClick = () => {
    if (onViewPyFile && file.name.endsWith(".py")) {
      onViewPyFile(file);
    }
  };

  // Example: if decryptionInProgress comes from useFileTransfer for download button
  // const isDownloadingAndDecrypting = decryptionInProgress && decryptionInProgress[file.fileId?.toString() ?? ""];

  return (
    <div className="flex items-center justify-between p-2 bg-muted rounded-md border border-border hover:bg-accent/40 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
        <div className="p-1 rounded bg-card text-primary border border-border hover:border-primary/20 hover:bg-accent/50 transition-colors flex-shrink-0">
          {getFileIcon(file.type, file.name)}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden font-medium text-sm font-mono truncate">
          <p className="truncate font-mono text-sm">{file.name}</p>
          <p className="text-xs text-muted-foreground truncate font-mono">
            {file.size.toFixed(2)} MB • {file.timestamp}
          </p>
          {file.fileId && (
            <p
              className="text-xs text-primary/70 font-mono truncate"
              title={file.fileId}
            >
              CID: {file.fileId.substring(0, 8)}...
              {file.fileId.substring(file.fileId.length - 6)}
            </p>
          )}
          {!file.fileId && (
            <p className="text-xs text-primary/70 font-mono truncate">
              CID: Not available
            </p>
          )}
          {file.isEncrypted && (
            <EncryptionBadge accessCondition={file.accessCondition} />
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
        {file.name.endsWith(".py") && onViewPyFile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleViewClick}
            className="h-7 w-7 p-0"
            disabled={!file.fileId || isProcessingPyView}
            title="View & Run Python Script"
          >
            {isProcessingPyView ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Eye size={14} />
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => copyFileCid(file.id.toString())}
          className="h-7 w-7 p-0"
          disabled={!file.fileId}
          title="Copy CID"
        >
          {copySuccess === file.id.toString() ? (
            <span className="text-green-500">✓</span>
          ) : (
            <Copy size={14} />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => downloadFile(file.id.toString())}
          className="h-7 w-7 p-0"
          // Simpler disable: if it's a .py file being viewed (and might be encrypted), don't allow simultaneous download
          // A more robust solution would involve checking `decryptionInProgress` from context for this specific file.
          disabled={
            !file.fileId ||
            (file.name.endsWith(".py") &&
              file.isEncrypted &&
              isProcessingPyView)
          }
          title="Download File"
        >
          {/* If using decryptionInProgress from context for download:
          {isDownloadingAndDecrypting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          For now, no separate loader for download button here unless context is updated */}
          <Download size={14} />
        </Button>
      </div>
    </div>
  );
};
