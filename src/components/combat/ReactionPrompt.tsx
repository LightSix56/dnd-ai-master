"use client";

// Окно выбора реакции (как в Baldur's Gate 3): что произошло, какие реакции доступны, отказ.
// Показывается тому, кто решает за бойца (его владелец или ведущий); остальным — строка ожидания.

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PendingReactionView } from "@/lib/combat/types";

interface Props {
  pending: PendingReactionView;
  /** Может ли этот клиент решать за бойца (владелец героя или ведущий) */
  canAnswer: boolean;
  busy: boolean;
  onAnswer: (choice: string) => void;
}

export function ReactionPrompt({ pending, canAnswer, busy, onAnswer }: Props) {
  const { prompt } = pending;
  const single = prompt.options.length === 1;

  if (!canAnswer) {
    return (
      <div
        role="status"
        className="fixed top-3 left-1/2 z-50 -translate-x-1/2 rounded-md border bg-background px-4 py-2 text-sm text-foreground shadow-md"
      >
        Ждём решения о реакции: {prompt.reactorName}
      </div>
    );
  }

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{prompt.title}</DialogTitle>
          <DialogDescription>
            {prompt.reactorName}: {prompt.text}
          </DialogDescription>
        </DialogHeader>

        {single ? (
          <p className="text-sm text-muted-foreground">{prompt.options[0].label}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {prompt.options.map((o) => (
              <Button key={o.id} variant="outline" className="justify-start" disabled={busy} onClick={() => onAnswer(o.id)}>
                {o.label}
              </Button>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => onAnswer("decline")}>
            {single ? "Нет" : "Не реагировать"}
          </Button>
          {single && (
            <Button disabled={busy} onClick={() => onAnswer(prompt.options[0].id)}>
              Да
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
