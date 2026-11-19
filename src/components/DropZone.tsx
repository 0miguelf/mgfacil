import { useCallback } from "react";
import { useDropzone, type Accept } from "react-dropzone";
import { UploadCloud } from "lucide-react";

export function DropZone({
  onFiles,
  accept,
  multiple = true,
  hint,
  compact = false,
}: {
  onFiles: (files: File[]) => void;
  accept?: Accept;
  multiple?: boolean;
  hint?: string;
  compact?: boolean;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length) onFiles(accepted);
    },
    [onFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple,
  });

  return (
    <div
      {...getRootProps()}
      className={`glass glass-hover cursor-pointer rounded-3xl border-2 border-dashed p-6 text-center transition ${
        isDragActive ? "border-primary bg-primary/5" : "border-white/70"
      } ${compact ? "py-6" : "py-10"}`}
      role="button"
      tabIndex={0}
      aria-label="Arrastar ficheiros ou clicar para selecionar"
    >
      <input {...getInputProps()} />
      <div className="mx-auto flex max-w-md flex-col items-center gap-2">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <UploadCloud className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-foreground">
          {isDragActive ? "Largue aqui os ficheiros" : "Arraste ficheiros ou clique para escolher"}
        </p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}
