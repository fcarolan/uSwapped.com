import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins, ImageIcon, Truck } from "lucide-react";
import PhotoUploader from "@/components/PhotoUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiPost } from "@/lib/api";
import { CATEGORIES, CONDITIONS, type Category, type Condition, type Item, type ItemCreate } from "@/lib/types";
import { creditsForValue, eur } from "@/lib/credits";
import { errorMessage } from "@/lib/hooks";

const field = "h-11 rounded-xl border-2 border-slate-900 bg-white";

export default function CreateListing() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [condition, setCondition] = useState<Condition | "">("");
  const [value, setValue] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const credits = creditsForValue(Number(value));

  const create = useMutation({
    mutationFn: (body: ItemCreate) => apiPost<Item>("/items", body),
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Your item is live! 🎉");
      navigate(`/items/${item.id}`);
    },
    onError: (e) => toast.error(errorMessage(e, "Please check the form and try again")),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!category || !condition) return toast.error("Pick a category and condition");
    if (!(Number(value) > 0)) return toast.error("Enter an estimated value");
    if (photos.length === 0) return toast.error("Add at least one photo");
    create.mutate({
      title: title.trim(),
      description: description.trim(),
      category,
      condition,
      value_eur: Number(value),
      images: photos,
      location: location.trim(),
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-4xl font-extrabold text-slate-900 sm:text-5xl" data-testid="create-listing-title">List an item to swap</h1>
      <p className="mt-2 text-slate-600">Takes about a minute. Your credit cost updates as you type.</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={submit} className="brutal space-y-5 rounded-3xl bg-white p-6 sm:p-8" data-testid="create-listing-form">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" data-testid="listing-title-input" className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Nintendo Switch with 2 games" required minLength={2} maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" data-testid="listing-description-input" className="min-h-28 rounded-xl border-2 border-slate-900" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Condition, what's included, any quirks…" required minLength={5} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v: string) => setCategory(v as Category)}>
                <SelectTrigger data-testid="listing-category-select" className={`${field} w-full`}>
                  <SelectValue>{(v) => (v ? String(v) : "Choose a category")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} data-testid={`listing-category-option-${c.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value={condition} onValueChange={(v: string) => setCondition(v as Condition)}>
                <SelectTrigger data-testid="listing-condition-select" className={`${field} w-full`}>
                  <SelectValue>{(v) => (v ? String(v) : "Choose condition")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c} data-testid={`listing-condition-option-${c.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="value">Estimated value (€)</Label>
              <Input id="value" data-testid="listing-value-input" type="number" min={1} step="0.01" className={field} value={value} onChange={(e) => setValue(e.target.value)} placeholder="45" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc">Location</Label>
              <Input id="loc" data-testid="listing-location-input" className={field} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Dublin" required minLength={2} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Photos</Label>
            <PhotoUploader photos={photos} onChange={setPhotos} />
          </div>
          <Button type="submit" data-testid="listing-submit-button" disabled={create.isPending} className="brutal brutal-hover h-12 w-full rounded-full text-base font-bold">
            {create.isPending ? "Publishing…" : "Publish listing"}
          </Button>
        </form>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="brutal overflow-hidden rounded-2xl bg-white" data-testid="listing-preview">
            <div className="grid aspect-[4/3] place-items-center border-b-2 border-slate-900 bg-slate-100">
              {photos[0] ? <img src={photos[0]} alt="" className="size-full object-cover" /> : <ImageIcon className="size-10 text-slate-400" />}
            </div>
            <div className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">{category || "Category"}</p>
              <p className="truncate text-lg font-bold">{title || "Your item title"}</p>
              <p className="font-mono text-xs text-slate-500">est. {value ? eur(Number(value)) : "€—"}</p>
            </div>
          </div>
          <div className="brutal rounded-2xl bg-amber-300 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em]">Swap cost for this item</p>
            <p key={credits} className="mt-1 inline-flex animate-pop-in items-center gap-2 font-heading text-4xl font-extrabold" data-testid="listing-credit-preview">
              <Coins className="size-8" /> {credits} {credits === 1 ? "credit" : "credits"}
            </p>
            <p className="mt-2 text-xs text-slate-800">Paid by whoever receives your item, when you accept their offer.</p>
          </div>
          <div className="flex gap-3 rounded-2xl border-2 border-slate-900 bg-sky-100 p-4 text-sm">
            <Truck className="size-5 shrink-0" />
            <p>You'll post this item yourself and cover postage &amp; packaging once a swap is agreed.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
