// components/files/FileList.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFileTransfer } from "@/context/FileTransferContext";
import { FileRow } from "./FileRow";
import { Upload, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { memo } from "react";
import { FileItem } from "@/types/files";

interface EmptyProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}

const EmptyState = ({ icon, title, subtitle }: EmptyProps) => {
  return (
    <div className="flex flex-col items-center p-6 text-muted-foreground/70">
      <div className="p-3 rounded-full bg-muted/40">{icon}</div>
      <p className="font-mono mt-3">{title}</p>
      <p className="text-xs mt-1">{subtitle}</p>
    </div>
  );
};

interface FileListProps {
  onViewPyFile?: (file: FileItem) => void;
  processingPyFileId?: string | null;
}

export const FileList = memo(
  ({ onViewPyFile, processingPyFileId }: FileListProps) => {
    const { sentFiles, receivedFiles } = useFileTransfer();

    return (
      <Tabs defaultValue="sent" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 font-mono">
          <TabsTrigger value="sent" className="flex items-center gap-2">
            <Upload size={16} />
            SENT_FILES
          </TabsTrigger>
          <TabsTrigger value="received" className="flex items-center gap-2">
            <Download size={16} />
            RECEIVED_FILES
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sent">
          <Card>
            <CardContent className="p-6 bg-card">
              <div className="h-[250px] overflow-y-auto overflow-x-hidden space-y-4">
                {sentFiles.length ? (
                  sentFiles.map((f) => (
                    <FileRow
                      key={f.id}
                      file={f}
                      // Pyodide typically runs on received files, but props are available
                      // onViewPyFile={onViewPyFile}
                      // isProcessingPyView={processingPyFileId === f.id.toString()}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={<Upload size={24} />}
                    title="No files sent"
                    subtitle="Upload files to see them here"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="received">
          <Card>
            <CardContent className="p-6 bg-card">
              <div className="h-[250px] overflow-y-auto overflow-x-hidden space-y-4">
                {receivedFiles.length ? (
                  receivedFiles.map((f) => (
                    <FileRow
                      key={f.id}
                      file={f}
                      onViewPyFile={onViewPyFile}
                      isProcessingPyView={
                        processingPyFileId === f.id.toString()
                      }
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={<Download size={24} />}
                    title="No files received"
                    subtitle="Incoming files will appear here"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    );
  }
);

// add FileList display name
FileList.displayName = "FileList";
