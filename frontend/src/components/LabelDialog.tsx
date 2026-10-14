import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiPost } from "@/lib/api";
import type { Address, CheckoutResponse, LabelCheckout, LabelSizeId } from "@/lib/types";
import { LABEL_SIZES, euro } from "@/lib/fees";
import { errorMessage } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const blank = (name: string): Address => ({ name, line1: "", line2: "", city: "", postcode: "", country: "Ireland" });

function AddressFields({ prefix, value, onChange }: { prefix: string; value: Address; onChange: (a: Address) => void }) {
  const field = (k: keyof Address, label: string, placeholder = "", required = true) => (
    <div className={cn("space-y-1", (k === "line1" || k === "line2") && "col-span-2")}>
      <Label htmlFor={`${prefix}-${k}`} className="text-xs">
        {label}
      </Label>
      <Input
        id={`${prefix}-${k}`}
        data-testid={`label-${prefix}-${k}-input`}
        value={value[k]}
        onChange={(e) => onChange({ ...value, [k]: e.target.value })}
        placeholder={placeholder}
        required={required}
        className="h-10 rounded-lg border-2 border-slate-300 focus-visible:border-slate-900"
      />
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {field("name", "Full name")}
      {field("country", "Country")}
      {field("line1", "Address", "Street and number")}
      {field("line2", "Apartment, area (optional)", "", false)}
      {field("city", "Town / city")}
      {field("postcode", "Eircode / postcode", "", false)}
    </div>
  );
}

export default function LabelDialog({
  open,
  onOpenChange,
  swapId,
  myName,
  otherName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  swapId: string;
  myName: string;
  otherName: string;
}) {
  const [size, setSize] = useState<LabelSizeId>("small");
  const [sender, setSender] = useState<Address>(blank(myName));
  const [recipient, setRecipient] = useState<Address>(blank(otherName));
  const chosen = LABEL_SIZES.find((s) => s.id === size) ?? LABEL_SIZES[0];

  const buy = useMutation({
    mutationFn: (body: LabelCheckout) => apiPost<CheckoutResponse>("/payments/label", body),
    onSuccess: (r) => window.location.assign(r.checkout_url),
    onError: (e) => toast.error(errorMessage(e, "Couldn't start the label checkout")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-3xl border-2 border-slate-900" data-testid="label-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-extrabold">Buy a tracked shipping label</DialogTitle>
          <DialogDescription>
            Optional. Print it, stick it on your parcel and drop it off. The tracking number is shared with {otherName.split(" ")[0]} automatically.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            buy.mutate({ swap_id: swapId, size, sender, recipient, origin_url: window.location.origin });
          }}
        >
          <div className="grid grid-cols-2 gap-2" data-testid="label-size-options">
            {LABEL_SIZES.map((s) => (
              <button
                key={s.id}
                type="button"
                data-testid={`label-size-${s.id}`}
                onClick={() => setSize(s.id)}
                className={cn(
                  "rounded-xl border-2 p-3 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.98]",
                  size === s.id ? "border-slate-900 bg-emerald-50 shadow-[3px_3px_0_#0f172a]" : "border-slate-200 hover:border-slate-400",
                )}
              >
                <span className="flex items-center justify-between">
                  <span className="text-sm font-bold">{s.label}</span>
                  <span className="font-heading font-extrabold">{euro(s.price_cents)}</span>
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-500">{s.description}</span>
              </button>
            ))}
          </div>
          <div>
            <p className="mb-2 font-heading text-sm font-extrabold">From (you)</p>
            <AddressFields prefix="sender" value={sender} onChange={setSender} />
          </div>
          <div>
            <p className="mb-2 font-heading text-sm font-extrabold">To ({otherName})</p>
            <AddressFields prefix="recipient" value={recipient} onChange={setRecipient} />
            <p className="mt-1.5 text-[11px] text-slate-500">Ask for their address in the chat if you don't have it yet.</p>
          </div>
          <p className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900" data-testid="label-demo-notice">
            DEMO MODE: labels and tracking numbers are samples until a shipping provider (e.g. Sendcloud or Shippo) is connected.
          </p>
          <Button type="submit" data-testid="label-buy-button" disabled={buy.isPending} className="brutal brutal-hover h-12 w-full rounded-full font-bold">
            <Tag className="size-4" /> {buy.isPending ? "Opening checkout…" : `Pay ${euro(chosen.price_cents)} for label`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
