import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Star, X } from "lucide-react";
import { apiUpload } from "@/lib/api";
import { errorMessage } from "@/lib/hooks";
import type { UploadResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export const MAX_PHOTOS = 4;
const MAX_SIDE = 1200;

// Decode any browser-readable image and re-encode as a ~1200px JPEG to keep uploads small.
async function resize(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.85),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PhotoUploader({ photos, onChange }: { photos: string[]; onChange: (p: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(0);
  const slotsLeft = MAX_PHOTOS - photos.length - pending;

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const picked = Array.from(files).slice(0, Math.max(0, slotsLeft));
    if (files.length > picked.length) toast.info(`You can add up to ${MAX_PHOTOS} photos`);
    setPending((n) => n + picked.length);
    const uploaded: string[] = [];
    await Promise.all(
      picked.map(async (file) => {
        try {
          const blob = await resize(file);
          const form = new FormData();
          form.append("file", blob, "photo.jpg");
          const r = await apiUpload<UploadResult>("/uploads", form);
          uploaded.push(r.url);
        } catch (e) {
          toast.error(errorMessage(e, `Couldn't upload ${file.name}`));
        } finally {
          setPending((n) => n - 1);
        }
      }),
    );
    if (uploaded.length) onChange([...photos, ...uploaded].slice(0, MAX_PHOTOS));
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (url: string) => onChange(photos.filter((p) => p !== url));
  const makeCover = (url: string) => onChange([url, ...photos.filter((p) => p !== url)]);

  return (
    <div data-testid="photo-uploader">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((url, i) => (
          <div
            key={url}
            data-testid={`photo-thumb-${i}`}
            className={cn(
              "group relative aspect-square animate-pop-in overflow-hidden rounded-xl border-2 border-slate-900 bg-slate-100",
              i === 0 && "shadow-[3px_3px_0_#0f172a]",
            )}
          >
            <img src={url} alt={`Photo ${i + 1}`} className="size-full object-cover" />
            {i === 0 ? (
              <span className="absolute bottom-1.5 left-1.5 rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
                Cover
              </span>
            ) : (
              <button
                type="button"
                data-testid={`photo-make-cover-${i}`}
                onClick={() => makeCover(url)}
                className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold transition-colors hover:bg-amber-200"
              >
                <Star className="size-3" /> Cover
              </button>
            )}
            <button
              type="button"
              aria-label="Remove photo"
              data-testid={`photo-remove-${i}`}
              onClick={() => remove(url)}
              className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full border-2 border-slate-900 bg-white transition-transform duration-150 hover:scale-110"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {Array.from({ length: pending }).map((_, i) => (
          <div key={`p-${i}`} className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-slate-400 bg-slate-50">
            <Loader2 className="size-6 animate-spin text-emerald-700" />
          </div>
        ))}
        {slotsLeft > 0 && (
          <button
            type="button"
            data-testid="photo-add-button"
            onClick={() => inputRef.current?.click()}
            className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-slate-900 bg-emerald-50 text-slate-800 transition-[background-color,transform] duration-150 hover:bg-emerald-100 active:scale-95"
          >
            <span className="flex flex-col items-center gap-1 text-xs font-bold">
              <Camera className="size-6" />
              {photos.length === 0 ? "Add photos" : "Add more"}
            </span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        data-testid="photo-file-input"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <p className="mt-2 text-xs text-slate-500">
        Up to {MAX_PHOTOS} photos. Take one with your camera or choose from your gallery. The first photo is the cover.
      </p>
    </div>
  );
}
