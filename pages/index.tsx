// pages/index.tsx
import MainLayout from "@/components/layout/MainLayout";
import { FileUpload } from "@/components/files/FileUpload";
import { FileList } from "@/components/files/FileList";
import WakuDebugConsole from "@/components/debug-consoles/WakuDebugConsole";
import CodexDebugConsole from "@/components/debug-consoles/CodexDebugConsole";
import TacoDebugConsole from "@/components/debug-consoles/TacoDebugConsole";
import Head from "next/head";
import { useState, useCallback } from "react"; // Added useCallback
import { FileItem } from "@/types/files";
import PyodideRunnerModal from "@/components/pyodide/PyodideRunnerModal";
import { toast } from "sonner"; // For potential direct toasts

export default function Home() {
  const [isPyodideModalOpen, setIsPyodideModalOpen] = useState(false);
  const [selectedPyFileForModal, setSelectedPyFileForModal] =
    useState<FileItem | null>(null);
  const [processingPyFileId, setProcessingPyFileId] = useState<string | null>(
    null
  );

  const handleViewPyFileRequest = useCallback((file: FileItem) => {
    if (!file.fileId) {
      toast.error("Cannot view script: File ID is missing.");
      return;
    }
    // It's good practice to ensure Pyodide script itself is loaded before modal fully commits
    // The modal now handles its own Pyodide loading internally based on isOpen.
    setProcessingPyFileId(file.id.toString()); // Show loading on FileRow
    setSelectedPyFileForModal(file);
    setIsPyodideModalOpen(true);
    // processingPyFileId will be cleared when modal closes or content is ready.
  }, []);

  const handleModalOpenChange = useCallback((isOpen: boolean) => {
    setIsPyodideModalOpen(isOpen);
    if (!isOpen) {
      setSelectedPyFileForModal(null);
      setProcessingPyFileId(null); // Clear processing state when modal is closed
    }
  }, []);

  return (
    <>
      <Head>
        <title>CypherShare</title>
        <meta
          name="description"
          content="Simple filesharing using Codex, Waku, TACo, and Pyodide"
        />
        {/* Add other meta tags from your old index.tsx if desired */}
      </Head>
      <MainLayout>
        <div className="container max-w-5xl py-8 mx-auto">
          {/* NodeInfo is available as a component if you want to uncomment it:
          <div className="space-y-4 mb-6">
             <NodeInfo />
          </div>
          */}
          <FileUpload />
          <div className="mt-6">
            <FileList
              onViewPyFile={handleViewPyFileRequest}
              processingPyFileId={processingPyFileId}
            />
          </div>
          <WakuDebugConsole />
          <CodexDebugConsole />
          <TacoDebugConsole />
        </div>
      </MainLayout>
      {isPyodideModalOpen &&
        selectedPyFileForModal && ( // Conditionally render to ensure props are set
          <PyodideRunnerModal
            isOpen={isPyodideModalOpen}
            onOpenChange={handleModalOpenChange}
            pythonFile={selectedPyFileForModal}
          />
        )}
    </>
  );
}
