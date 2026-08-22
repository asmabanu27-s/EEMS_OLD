import { Badge } from "@/components/ui/badge";

export type Status =
  | "ACTIVE"
  | "INACTIVE"
  | "PRESENT"
  | "ABSENT"
  | "LEAVE"
  | "HOLIDAY"
  | "WEEKEND"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

interface StatusBadgeProps {
  status: Status;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variant =
    status === "APPROVED" || status === "ACTIVE" || status === "PRESENT"
      ? "default"
      : status === "REJECTED" || status === "ABSENT" || status === "INACTIVE"
        ? "destructive"
        : "secondary";

  return <Badge variant={variant}>{status.replaceAll("_", " ")}</Badge>;
}
