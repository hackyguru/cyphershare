// components/files/FileUpload.tsx
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { useCallback } from "react";
import { useFileTransfer } from "@/context/FileTransferContext";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  maxSizeMB?: number;
  allowedTypes?: string[];
}

export const FileUpload = ({ maxSizeMB = 100, allowedTypes = [] }: FileUploadProps) => {
  const { sendFiles } = useFileTransfer();

  const handleDrop = useCallback((accepted: File[]) => {
    if (accepted.length) {
      void sendFiles(accepted);
    }
  }, [sendFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    maxFiles: 1,
    maxSize: maxSizeMB * 1024 * 1024,
    accept: allowedTypes.length ? Object.fromEntries(allowedTypes.map(t => [t, []])) : undefined
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all mb-4 bg-card shadow-sm relative overflow-hidden",
          isDragActive
            ? "border-primary bg-accent scale-[0.99]"
            : "border-border hover:border-primary/50 hover:bg-accent/50"
        )}
      >
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-scanline" />
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center gap-3 relative z-10">
          <div className={cn("p-4 rounded-full bg-accent transition-transform", isDragActive && "scale-110")}>
            <Upload size={36} className={cn("transition-colors", isDragActive ? "text-primary" : "text-primary/70")} />
          </div>
          <h3 className="text-lg font-medium mt-2 font-mono">
            {isDragActive ? "Drop to share" : "Drag and drop your files here"}
          </h3>
          <p className="text-sm text-muted-foreground mb-2 font-mono">or click to select files</p>
          <div className="px-4 py-1.5 rounded-full bg-muted text-xs text-muted-foreground font-mono border border-primary/10">
            MAX_SIZE={maxSizeMB}MB
          </div>
        </div>
      </div>
    </div>
  );
}
