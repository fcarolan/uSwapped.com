import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  /** data-testid of the trigger button; the dialog uses `${testid}-dialog`, `-confirm`, `-input`. */
  testid: string;
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  disabled?: boolean;
  size?: "xs" | "sm";
  triggerVariant?: "outline" | "destructive";
  /** If set, the admin must type this exact word to enable the confirm button. */
  requireText?: string;
  /** If set, shows a text input pre-filled with this value and passes it to onConfirm. */
  defaultInput?: string;
  inputLabel?: string;
  onConfirm: (input: string) => void;
};

/** In-app confirmation dialog for admin actions (replaces window.confirm/prompt). */
export default function ConfirmAction(p: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(p.defaultInput ?? "");
  const needsInput = p.requireText !== undefined || p.defaultInput !== undefined;
  const blocked = p.requireText !== undefined && value.trim() !== p.requireText;
  return (
    <>
      <Button
        size={p.size ?? "xs"}
        variant={p.triggerVariant ?? "outline"}
        data-testid={p.testid}
        disabled={p.disabled}
        onClick={() => {
          setValue(p.defaultInput ?? "");
          setOpen(true);
        }}
      >
        {p.trigger}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl border-2 border-slate-900" data-testid={`${p.testid}-dialog`}>
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{p.title}</DialogTitle>
            <DialogDescription>{p.description}</DialogDescription>
          </DialogHeader>
          {needsInput && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-600">
                {p.requireText !== undefined ? <>Type <strong>{p.requireText}</strong> to confirm</> : p.inputLabel}
              </p>
              <Input
                data-testid={`${p.testid}-input`}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                maxLength={200}
                className="h-11 rounded-xl border-2 border-slate-900"
                autoFocus
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" data-testid={`${p.testid}-cancel`} onClick={() => setOpen(false)} className="rounded-full">
              Keep it
            </Button>
            <Button
              variant={p.destructive ? "destructive" : "default"}
              data-testid={`${p.testid}-confirm`}
              disabled={blocked}
              onClick={() => {
                setOpen(false);
                p.onConfirm(value.trim());
              }}
              className="rounded-full"
            >
              {p.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
