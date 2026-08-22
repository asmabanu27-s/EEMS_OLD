import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ExportFileType = "xlsx" | "pdf" | "csv";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (fileType: ExportFileType) => void;
  title?: string;
}

export function ExportDialog({
  open,
  onOpenChange,
  onExport,
  title = "Export",
}: ExportDialogProps) {
  const [fileType, setFileType] = useState<ExportFileType>("xlsx");

  function handleExport() {
    onExport(fileType);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>

          <DialogDescription>
            Select the file format for your export.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <label htmlFor="export-file-type" className="text-sm font-medium">
            File Type
          </label>

          <select
            id="export-file-type"
            value={fileType}
            onChange={(event) =>
              setFileType(event.target.value as ExportFileType)
            }
            className="mt-2 flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="xlsx">Excel (.xlsx)</option>

            <option value="pdf">PDF (.pdf)</option>

            <option value="csv">CSV (.csv)</option>
          </select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>

          <Button onClick={handleExport}>Export</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
