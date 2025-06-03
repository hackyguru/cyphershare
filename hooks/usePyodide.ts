// hooks/usePyodide.ts
import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { PyodideInterface } from "pyodide";

// Add declaration for loadPyodide on Window interface
declare global {
  interface Window {
    loadPyodide: (options: { indexURL: string }) => Promise<PyodideInterface>;
  }
}

// Keep these at the module level to ensure singleton-like behavior for the instance
let pyodideInstance: PyodideInterface | null = null;
let pyodideLoadingPromise: Promise<PyodideInterface> | null = null;

export interface PyodideFile {
  name: string;
  content: Uint8Array; // File content as bytes
}

export function usePyodide() {
  const [pyodide, setPyodide] = useState<PyodideInterface | null>(
    pyodideInstance
  );
  const [isPyodideReady, setIsPyodideReady] = useState(!!pyodideInstance);
  const [pyodideLoadingMessage, setPyodideLoadingMessage] = useState<
    string | null
  >(pyodideInstance ? "Pyodide is ready." : "Pyodide loading not yet started.");

  const ensurePyodideLoaded = useCallback(async () => {
    if (pyodideInstance) {
      if (pyodide !== pyodideInstance) setPyodide(pyodideInstance); // Ensure state sync
      if (!isPyodideReady) setIsPyodideReady(true);
      if (pyodideLoadingMessage !== "Pyodide is ready.")
        setPyodideLoadingMessage("Pyodide is ready.");
      return pyodideInstance;
    }
    if (pyodideLoadingPromise) {
      setPyodideLoadingMessage("Pyodide is currently loading...");
      await pyodideLoadingPromise;
      setPyodide(pyodideInstance);
      setIsPyodideReady(true);
      setPyodideLoadingMessage("Pyodide is ready.");
      return pyodideInstance;
    }

    setPyodideLoadingMessage("Loading Pyodide runtime...");
    console.log("usePyodide: Attempting to load Pyodide...");

    const loadScript = (): Promise<void> =>
      new Promise((resolve, reject) => {
        if (typeof window.loadPyodide === "function") return resolve();
        setPyodideLoadingMessage("Loading Pyodide script from CDN...");
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js";
        script.async = true;
        script.onload = () => {
          console.log("usePyodide: Pyodide script loaded.");
          resolve();
        };
        script.onerror = (err) => {
          console.error("usePyodide: Failed to load Pyodide script.", err);
          setPyodideLoadingMessage(
            "Failed to load Pyodide script. Check network or adblockers."
          );
          reject(new Error("Failed to load Pyodide script."));
        };
        document.head.appendChild(script);
      });

    pyodideLoadingPromise = loadScript()
      .then(() =>
        window.loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/",
        })
      )
      .then((instance) => {
        pyodideInstance = instance;
        setPyodide(instance);
        setIsPyodideReady(true);
        setPyodideLoadingMessage("Pyodide loaded successfully.");
        console.log("usePyodide: Pyodide loaded successfully");
        pyodideLoadingPromise = null;
        return instance;
      })
      .catch((error) => {
        console.error("usePyodide: Failed to load Pyodide:", error);
        setPyodideLoadingMessage(`Error loading Pyodide: ${error.message}`);
        setIsPyodideReady(false);
        pyodideLoadingPromise = null;
        throw error; // Re-throw to allow callers to handle
      });
    return pyodideLoadingPromise;
  }, [pyodide, isPyodideReady, pyodideLoadingMessage]); // Dependencies ensure re-check if state is out of sync

  const loadFilesToFs = useCallback(
    async (files: PyodideFile[], targetDir: string = "/home") => {
      if (!pyodide || !isPyodideReady) {
        toast.error("Pyodide not ready to load files.");
        throw new Error("Pyodide not ready.");
      }
      const loadedPaths: string[] = [];
      for (const file of files) {
        const sanitizedName = file.name.replace(/\s+/g, "_");
        const filePath = `${targetDir}/${sanitizedName}`;
        // Try to create directory if it doesn't exist
        try {
          pyodide.FS.mkdirTree(targetDir);
        } catch (error) {
          if (isErrnoError(error) && error.errno === 17) {
            // Directory already exists, which is fine
          } else {
            throw error; // Re-throw if it's a different error
          }
        }
        pyodide.FS.writeFile(filePath, file.content);
        loadedPaths.push(filePath);
      }
      return loadedPaths;
    },
    [pyodide, isPyodideReady]
  );

  const setGlobalVariable = useCallback(
    (name: string, value: string[]) => {
      if (!pyodide || !isPyodideReady) {
        toast.error("Pyodide not ready to set global variable.");
        throw new Error("Pyodide not ready.");
      }
      pyodide.globals.set(name, pyodide.toPy(value));
    },
    [pyodide, isPyodideReady]
  );

  const runPythonAsync = useCallback(
    async (
      scriptContent: string,
      stdoutCallback?: (msg: string) => void,
      stderrCallback?: (msg: string) => void
    ) => {
      if (!pyodide || !isPyodideReady) {
        toast.error("Pyodide not ready to run script.");
        throw new Error("Pyodide not ready.");
      }
      if (stdoutCallback) pyodide.setStdout({ batched: stdoutCallback });
      if (stderrCallback) pyodide.setStderr({ batched: stderrCallback });

      await pyodide.loadPackagesFromImports(scriptContent); // Load packages based on script
      return await pyodide.runPythonAsync(scriptContent);
    },
    [pyodide, isPyodideReady]
  );

  const readFileFromFs = useCallback(
    (
      path: string,
      encoding: "utf8" | "binary" = "utf8"
    ): string | Uint8Array => {
      if (!pyodide || !isPyodideReady) {
        toast.error("Pyodide not ready to read file.");
        throw new Error("Pyodide not ready.");
      }
      const data = pyodide.FS.readFile(path);
      return encoding === "utf8" ? new TextDecoder().decode(data) : data;
    },
    [pyodide, isPyodideReady]
  );

  const listDirFs = useCallback(
    (path: string): string[] => {
      if (!pyodide || !isPyodideReady) {
        toast.error("Pyodide not ready to list directory.");
        throw new Error("Pyodide not ready.");
      }
      return pyodide.FS.readdir(path);
    },
    [pyodide, isPyodideReady]
  );

  return {
    pyodide, // The instance, if direct access is needed
    isPyodideReady,
    pyodideLoadingMessage,
    ensurePyodideLoaded,
    loadFilesToFs,
    setGlobalVariable,
    runPythonAsync,
    readFileFromFs,
    listDirFs,
  };
}

/**
 * Define the FS.ErrnoError type explicitly since it is not exported by the 'pyodide' module.
 */
interface FSErrnoError extends Error {
  errno: number;
}

function isErrnoError(error: unknown): error is FSErrnoError {
  return typeof error === "object" && error !== null && "errno" in error;
}
