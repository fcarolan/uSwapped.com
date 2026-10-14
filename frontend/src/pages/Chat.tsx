import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowLeftRight, Mail, Send, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost } from "@/lib/api";
import type { Message, MessageCreate, Swap } from "@/lib/types";
import { errorMessage, useMe } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const QUICK = ["Hi! When can you post yours?", "I'll post mine tomorrow 📦", "Here's my tracking number:", "Received it, thanks! 🎉"];

export default function Chat() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const swapQ = useQuery({ queryKey: ["swap", id], queryFn: () => apiGet<Swap>(`/swaps/${id}`) });
  const msgsQ = useQuery({
    queryKey: ["messages", id],
    queryFn: () => apiGet<Message[]>(`/swaps/${id}/messages`),
    refetchInterval: 4000,
  });
  const swap = swapQ.isError ? undefined : swapQ.data;
  const messages = msgsQ.isError ? [] : (msgsQ.data ?? []);

  const send = useMutation({
    mutationFn: (body: MessageCreate) => apiPost<Message>(`/swaps/${id}/messages`, body),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["messages", id] });
    },
    onError: (e) => toast.error(errorMessage(e, "Message not sent")),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) send.mutate({ body: text.trim() });
  };

  const iAmProposer = swap && me && swap.proposer_id === me.user_id;
  const otherName = swap ? (iAmProposer ? swap.owner_name : swap.proposer_name) : "";
  const give = swap ? (iAmProposer ? swap.offered_item : swap.target_item) : null;
  const get = swap ? (iAmProposer ? swap.target_item : swap.offered_item) : null;
  const open = swap?.status === "accepted";

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-6 sm:px-6">
      <Link to="/dashboard?tab=outgoing" data-testid="chat-back-link" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Back to swaps
      </Link>

      <div className="brutal mt-4 rounded-2xl bg-white p-4" data-testid="chat-header">
        {swapQ.isPending ? (
          <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
        ) : !swap ? (
          <p className="text-sm text-slate-600" data-testid="chat-not-found">This swap couldn't be loaded.</p>
        ) : (
          <div className="flex items-center gap-3">
            {give && <img src={give.image_url} alt="" className="size-12 rounded-xl border-2 border-slate-900 object-cover" />}
            <ArrowLeftRight className="size-4 shrink-0 text-emerald-700" />
            {get && <img src={get.image_url} alt="" className="size-12 rounded-xl border-2 border-slate-900 object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading font-extrabold" data-testid="chat-title">Chat with {otherName}</p>
              <p className="truncate text-xs text-slate-500">
                You give {give?.title} · you get {get?.title}
              </p>
            </div>
            {swap.counterpart_email && (
              <a href={`mailto:${swap.counterpart_email}`} aria-label="Email" data-testid="chat-email-link" className="hidden rounded-full border-2 border-slate-900 p-2 sm:block">
                <Mail className="size-4" />
              </a>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-sky-100 px-3 py-2 text-xs text-slate-700">
        <Truck className="mt-0.5 size-4 shrink-0" /> Each of you posts your own item at your own cost. Share addresses and tracking here.
      </div>

      <div className="mt-4 min-h-[40vh] flex-1 space-y-2 overflow-y-auto rounded-2xl border-2 border-slate-200 bg-white/60 p-4" data-testid="chat-messages">
        {messages.length === 0 && !msgsQ.isPending && (
          <p className="py-10 text-center text-sm text-slate-500" data-testid="chat-empty">
            Say hello 👋 and agree when you'll both post your items.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === me?.user_id;
          return (
            <div key={m.id} className={cn("flex animate-pop-in", mine ? "justify-end" : "justify-start")} data-testid={`chat-message-${m.id}`}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl border-2 border-slate-900 px-3.5 py-2 text-sm",
                  mine ? "rounded-br-sm bg-emerald-300" : "rounded-bl-sm bg-white",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className="mt-0.5 text-right text-[10px] text-slate-600">
                  {new Date(m.created_at).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {open ? (
        <>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {QUICK.map((q, i) => (
              <button
                key={q}
                type="button"
                data-testid={`chat-quick-reply-${i}`}
                onClick={() => setText(q)}
                className="shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold transition-colors hover:border-slate-900"
              >
                {q}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] mt-2 flex gap-2 md:bottom-4">
            <Input
              data-testid="chat-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write a message…"
              maxLength={1000}
              className="h-12 rounded-full border-2 border-slate-900 bg-white px-5"
            />
            <Button type="submit" data-testid="chat-send-button" disabled={!text.trim() || send.isPending} className="brutal brutal-hover size-12 rounded-full p-0">
              <Send className="size-5" />
            </Button>
          </form>
        </>
      ) : (
        swap && (
          <p className="mt-4 text-center text-sm text-slate-500" data-testid="chat-closed">
            Chat opens once the swap is accepted.
          </p>
        )
      )}
    </div>
  );
}
