import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this information.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border p-8 text-center">
      <h3 className="font-medium">{title}</h3>

      <p className="mt-1 text-sm text-muted-foreground">{description}</p>

      {onRetry && (
        <Button className="mt-4" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
