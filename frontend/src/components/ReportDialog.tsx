import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiPost } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { Report, ReportCreate, ReportReason } from "@/lib/types";

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "prohibited", label: "Prohibited or illegal item" },
  { id: "scam", label: "Looks like a scam" },
  { id: "misleading", label: "Misleading photos or value" },
  { id: "offensive", label: "Offensive content" },
  { id: "other", label: "Something else" },
];

export default function ReportDialog({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("prohibited");
  const [details, setDetails] = useState("");
  const report = useMutation({
    mutationFn: (body: ReportCreate) => apiPost<Report>("/reports", body),
    onSuccess: () => {
      setOpen(false);
      setDetails("");
      toast.success("Thanks, our team will review this listing");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            data-testid="item-report-button"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors duration-150 hover:text-red-700"
          />
        }
      >
        <Flag className="size-3.5" /> Report this listing
      </DialogTrigger>
      <DialogContent className="rounded-3xl border-2 border-slate-900" data-testid="report-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Report this listing</DialogTitle>
          <DialogDescription>Reports are private. The owner won't see who reported them.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              data-testid={`report-reason-${r.id}`}
              onClick={() => setReason(r.id)}
              className={cn(
                "rounded-xl border-2 px-4 py-2.5 text-left text-sm font-semibold transition-colors duration-150",
                reason === r.id ? "border-slate-900 bg-red-50" : "border-slate-200 hover:border-slate-400",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <Textarea
          data-testid="report-details-input"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={500}
          placeholder="Anything else we should know? (optional)"
          className="rounded-xl border-2 border-slate-900"
        />
        <DialogFooter>
          <Button
            variant="destructive"
            data-testid="report-submit-button"
            disabled={report.isPending}
            onClick={() => report.mutate({ item_id: itemId, reason, details })}
            className="rounded-full"
          >
            <Flag className="size-4" /> Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
