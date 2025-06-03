// components/pyodide/PyodideRunnerModal.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { FileItem } from "@/types/files";
import { useFileTransfer } from "@/context/FileTransferContext";
import { useFileEncryption } from "@/hooks/useFileEncryption";
import { useCodexContext } from "@/context/CodexContext";
import { Loader2 } from "lucide-react";
import { usePyodide, PyodideFile } from "@/hooks/usePyodide"; // Import the new hook

interface PyodideRunnerModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  pythonFile: FileItem | null;
}

export default function PyodideRunnerModal({
  isOpen,
  onOpenChange,
  pythonFile,
}: PyodideRunnerModalProps) {
  const {
    isPyodideReady,
    pyodideLoadingMessage,
    ensurePyodideLoaded,
    loadFilesToFs,
    setGlobalVariable,
    runPythonAsync: runPyodideScript, // Renamed to avoid conflict
    readFileFromFs,
    listDirFs,
  } = usePyodide();

  const [pyFileContent, setPyFileContent] = useState("");
  const [selectedDataFiles, setSelectedDataFiles] = useState<FileList | null>(
    null
  );
  const dataFileInputRef = useRef<HTMLInputElement>(null);
  const [pyodideOutput, setPyodideOutput] = useState<string[]>([]); // For UI display
  const [isScriptRunning, setIsScriptRunning] = useState(false);
  const [pyodideOutputFilePath, setPyodideOutputFilePath] = useState<
    string | null
  >(null);

  const { sendFiles: sendOutputFiles, uploadingFiles } = useFileTransfer();
  const { decryptBlob } = useFileEncryption();
  const { downloadFile: codexDownloadFileContent, isCodexNodeActive } =
    useCodexContext();

  const outputFileNameGuess = pyodideOutputFilePath?.split("/").pop();
  const isOutputUploading = outputFileNameGuess
    ? Object.values(uploadingFiles).some((f) => f.name === outputFileNameGuess)
    : false;
  const outputUploadProgress = outputFileNameGuess
    ? Object.values(uploadingFiles).find((f) => f.name === outputFileNameGuess)
        ?.progress ?? 0
    : 0;

  // Effect to ensure Pyodide is loaded when the modal opens
  useEffect(() => {
    if (isOpen) {
      ensurePyodideLoaded().catch((err) => {
        // Error during Pyodide load is handled by the hook's state (pyodideLoadingMessage)
        console.error("Modal: Pyodide failed to load via hook", err);
        toast.error("Pyodide engine could not be loaded.");
      });
    }
  }, [isOpen, ensurePyodideLoaded]);

  // Effect to fetch Python script content
  useEffect(() => {
    if (!isOpen || !pythonFile || !pythonFile.fileId) {
      setPyFileContent("");
      return;
    }
    const fetchContent = async () => {
      toast.info(`Fetching ${pythonFile.name}...`);
      try {
        const result = await codexDownloadFileContent(pythonFile.fileId!);
        if (!result.success || !result.data) {
          throw new Error(result.error || "Failed to download script.");
        }
        let blob = result.data;
        if (pythonFile.isEncrypted) {
          toast.info(`Decrypting ${pythonFile.name}...`);
          const decryptResult = await decryptBlob(blob, {
            fileType: "text/plain",
            accessCondition: pythonFile.accessCondition,
          });
          if (!decryptResult.decryptedBlob) {
            throw new Error(
              decryptResult.error?.message || "Decryption failed."
            );
          }
          blob = decryptResult.decryptedBlob;
        }
        const content = await blob.text();
        setPyFileContent(content);
        toast.success(`${pythonFile.name} content loaded.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Error loading script: ${msg}`);
        setPyFileContent(`# Error loading script: ${msg}`);
      }
    };
    fetchContent();
  }, [isOpen, pythonFile, codexDownloadFileContent, decryptBlob]);

  const handleRunScript = useCallback(async () => {
    if (!isPyodideReady) {
      toast.error("Pyodide is not ready.");
      return;
    }
    if (!pyFileContent) {
      toast.error("No Python script content loaded.");
      return;
    }
    if (!selectedDataFiles || selectedDataFiles.length === 0) {
      toast.error("No data files selected to run the script on.");
      return;
    }

    setIsScriptRunning(true);
    setPyodideOutputFilePath(null);
    const initialOutput = [
      `Running script: ${pythonFile?.name || "script.py"}...`,
    ];
    setPyodideOutput(initialOutput); // Reset and set initial
    toast.info(`Running script: ${pythonFile?.name || "script.py"}`);

    try {
      const currentOutput = [...initialOutput]; // Local array for batching updates to state
      const appendOutput = (msg: string) => {
        currentOutput.push(msg);
        // Batch state updates slightly for performance if many rapid logs
        // For now, direct update is fine for simplicity unless performance issues arise
        setPyodideOutput([...currentOutput]);
      };

      appendOutput("Loading data files into Pyodide FS...");
      const pyodideFilesToLoad: PyodideFile[] = [];
      for (const file of Array.from(selectedDataFiles)) {
        const arrayBuffer = await file.arrayBuffer();
        pyodideFilesToLoad.push({
          name: file.name,
          content: new Uint8Array(arrayBuffer),
        });
      }
      const loadedDataFilePaths = await loadFilesToFs(
        pyodideFilesToLoad,
        "/home"
      );
      loadedDataFilePaths.forEach((path, index) => {
        appendOutput(`Loaded ${selectedDataFiles[index].name} to ${path}`);
      });

      const filesInPyodideHome = listDirFs("/home");
      appendOutput(
        `Current files in Pyodide's /home/ directory: ${filesInPyodideHome.join(
          ", "
        )}`
      );

      setGlobalVariable("SELECTED_DATA_FILES", loadedDataFilePaths);
      appendOutput(
        `Made selected file paths available to Python as SELECTED_DATA_FILES: ${loadedDataFilePaths.join(
          ", "
        )}`
      );

      appendOutput("Executing Python script...");
      const result = await runPyodideScript(
        pyFileContent,
        (stdoutMsg) => appendOutput(`[stdout] ${stdoutMsg}`),
        (stderrMsg) => appendOutput(`[stderr] ${stderrMsg}`)
      );
      appendOutput("Script execution finished.");
      if (result !== undefined) {
        appendOutput(`Result: ${String(result)}`);
      }

      // Output file detection (same logic as before, using listDirFs and readFileFromFs)
      let detectedOutputPath: string | null = null;
      const filesAfterRun = listDirFs("/home");
      const potentialOutputFiles = filesAfterRun.filter((f) => {
        const isInputFile = loadedDataFilePaths.some((inputPath) =>
          inputPath.endsWith(f.replace(/\s+/g, "_"))
        ); // Compare with sanitized names
        return (
          !isInputFile &&
          (f.toLowerCase().includes("output") ||
            f.toLowerCase().includes("summary") ||
            f.toLowerCase().includes("result") ||
            f.toLowerCase().endsWith(".txt") ||
            f.toLowerCase().endsWith(".csv"))
        );
      });

      const nonPyOutputFiles = potentialOutputFiles.filter(
        (f) => !f.toLowerCase().endsWith(".py")
      );
      if (nonPyOutputFiles.length > 0) {
        detectedOutputPath = `/home/${nonPyOutputFiles[0]}`;
      } else if (potentialOutputFiles.length > 0) {
        detectedOutputPath = `/home/${potentialOutputFiles[0]}`;
      }

      if (detectedOutputPath) {
        appendOutput(`Output file detected: ${detectedOutputPath}`);
        setPyodideOutputFilePath(detectedOutputPath);
        try {
          const outputContent = readFileFromFs(
            detectedOutputPath,
            "utf8"
          ) as string; // Assuming text
          appendOutput(`--- Content of ${detectedOutputPath} ---`);
          appendOutput(
            outputContent.substring(0, 2000) +
              (outputContent.length > 2000
                ? "\n... (content truncated) ..."
                : "")
          );
          appendOutput(`--- End ---`);
          toast.success(
            `Script finished. Output file detected: ${detectedOutputPath
              .split("/")
              .pop()}`
          );
        } catch (readErr: Error | unknown) {
          const errorMessage =
            readErr instanceof Error ? readErr.message : String(readErr);
          appendOutput(
            `Could not read content of ${detectedOutputPath}: ${errorMessage}`
          );
          toast.info(
            `Script finished. Output file detected but content could not be read: ${detectedOutputPath
              .split("/")
              .pop()}`
          );
        }
      } else {
        appendOutput(
          `No clear output file detected in /home/. Check script logic if output was expected. Files in /home: ${filesAfterRun.join(
            ", "
          )}`
        );
        toast.info("Script finished. No new specific output file found.");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setPyodideOutput((prev) => [...prev, `Execution Error: ${errorMsg}`]); // Ensure this still works if appendOutput isn't used in catch
      toast.error(`Script execution error: ${errorMsg}`);
    } finally {
      setIsScriptRunning(false);
    }
  }, [
    isPyodideReady,
    pythonFile,
    pyFileContent,
    selectedDataFiles,
    loadFilesToFs,
    setGlobalVariable,
    runPyodideScript,
    readFileFromFs,
    listDirFs,
  ]);

  const handleUploadOutput = useCallback(async () => {
    if (!isPyodideReady || !pyodideOutputFilePath || !isCodexNodeActive) {
      toast.error(
        "Cannot upload: Pyodide not ready, no output file, or Codex inactive."
      );
      return;
    }
    const outputFileName =
      pyodideOutputFilePath.split("/").pop() || `py_output_${Date.now()}.txt`;
    toast.info(`Preparing to upload ${outputFileName}...`);
    try {
      const fileContentUint8Array = readFileFromFs(
        pyodideOutputFilePath,
        "binary"
      ) as Uint8Array;
      const outputFileBlob = new Blob([fileContentUint8Array], {
        type: "application/octet-stream",
      });
      const outputFile = new File([outputFileBlob], outputFileName, {
        type: outputFileBlob.type,
      });
      await sendOutputFiles([outputFile]);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Error preparing output for upload: ${errorMsg}`);
    }
  }, [
    isPyodideReady,
    pyodideOutputFilePath,
    sendOutputFiles,
    isCodexNodeActive,
    readFileFromFs,
  ]);

  const handleModalClose = () => {
    onOpenChange(false);
    setPyFileContent("");
    setPyodideOutput([]);
    setSelectedDataFiles(null);
    if (dataFileInputRef.current) dataFileInputRef.current.value = "";
    setPyodideOutputFilePath(null);
    setIsScriptRunning(false);
  };

  // Render logic remains largely the same, using the hook's state and functions
  // ... (JSX for Dialog, DialogContent, etc.) ...
  // (The existing JSX for the modal can be used here, just ensure it calls the hook's functions
  // and uses the hook's state variables like isPyodideReady, pyodideLoadingMessage)

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-[700px] md:max-w-[900px] lg:max-w-[1100px] h-[90vh] flex flex-col bg-card border-border">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="font-mono text-primary">
            View & Run: {pythonFile?.name || "Python Script"}
          </DialogTitle>
          <DialogDescription className="font-mono text-muted-foreground">
            View script, select data file(s), run in Pyodide, and upload output.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow overflow-hidden min-h-0">
          <div className="flex flex-col overflow-hidden border border-input rounded-md p-1 bg-background">
            <h3 className="text-sm font-mono text-center py-1 text-primary/80">
              Script: {pythonFile?.name || "N/A"}
            </h3>
            <ScrollArea className="flex-grow p-1">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all p-2 text-foreground">
                {pyFileContent ||
                  (pythonFile
                    ? "Loading script content..."
                    : "No script selected.")}
              </pre>
            </ScrollArea>
          </div>

          <div className="flex flex-col overflow-hidden border border-input rounded-md p-1 bg-background">
            <h3 className="text-sm font-mono text-center py-1 text-primary/80">
              Execution Output & Logs
            </h3>
            <ScrollArea className="flex-grow p-1 mb-2 text-xs font-mono whitespace-pre-wrap break-all bg-black/80 text-green-400 rounded min-h-[100px]">
              {!isPyodideReady && pyodideLoadingMessage && (
                <p className="p-2 text-amber-400">{pyodideLoadingMessage}</p>
              )}
              {isPyodideReady &&
                pyodideOutput.length === 0 &&
                !isScriptRunning && (
                  <p className="p-2 text-green-400">
                    {pyodideLoadingMessage}. Select data file(s) and run script.
                  </p>
                )}
              {pyodideOutput.map((line, index) => (
                <div
                  key={index}
                  className={`p-1 ${
                    line.startsWith("[stderr]") ||
                    line.startsWith("Execution Error:") ||
                    line.toLowerCase().includes("error:")
                      ? "text-red-400"
                      : line.toLowerCase().includes("warning:")
                      ? "text-yellow-400"
                      : ""
                  }`}
                >
                  {line}
                </div>
              ))}
              {isScriptRunning && (
                <div className="p-2 text-blue-400 animate-pulse flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Script is
                  running...
                </div>
              )}
              {isOutputUploading && (
                <p className="p-2 text-blue-400 animate-pulse">
                  Uploading output: {outputUploadProgress}%
                </p>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="mt-2 pt-3 border-t border-border items-center">
          <div className="flex-grow text-xs text-muted-foreground font-mono mr-auto">
            {selectedDataFiles
              ? `${selectedDataFiles.length} data file(s) selected`
              : "No data files selected"}
            {pyodideOutputFilePath &&
              ` | Output: ${pyodideOutputFilePath.split("/").pop()}`}
          </div>
          <Button
            variant="outline"
            className="font-mono"
            onClick={() => dataFileInputRef.current?.click()}
            disabled={!isPyodideReady || isScriptRunning || isOutputUploading}
          >
            Choose Data File(s)
          </Button>
          <input
            type="file"
            ref={dataFileInputRef}
            className="hidden"
            multiple
            onChange={(e) => {
              setSelectedDataFiles(e.target.files);
              if (e.target.files && e.target.files.length > 0) {
                toast.info(`Selected ${e.target.files.length} data file(s).`);
              } else {
                toast.info("Data file selection cleared.");
              }
              e.target.value = "";
            }}
          />
          <Button
            variant="default"
            className="font-mono"
            onClick={handleRunScript}
            disabled={
              !isPyodideReady ||
              isScriptRunning ||
              !selectedDataFiles ||
              selectedDataFiles.length === 0 ||
              !pyFileContent ||
              isOutputUploading
            }
          >
            {isScriptRunning ? (
              <Loader2 size={16} className="animate-spin mr-2" />
            ) : null}
            {isScriptRunning ? "Running..." : "Run Script"}
          </Button>
          <Button
            variant="secondary"
            className="font-mono"
            onClick={handleUploadOutput}
            disabled={
              !isPyodideReady ||
              isScriptRunning ||
              !pyodideOutputFilePath ||
              !isCodexNodeActive ||
              isOutputUploading
            }
          >
            {isOutputUploading ? (
              <Loader2 size={16} className="animate-spin mr-2" />
            ) : null}
            {isOutputUploading
              ? `Uploading ${outputUploadProgress}%...`
              : "Upload Output"}
          </Button>
          <DialogClose asChild>
            <Button variant="outline" className="font-mono">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
