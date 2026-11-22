"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogPortal = DialogPrimitive.Portal;

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn("fixed inset-0 z-[80] bg-[rgb(20_22_15/0.55)]", className)}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-[85] w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2",
          "max-h-[calc(100svh-48px)] overflow-y-auto rounded-[2px] border border-line-strong bg-surface p-6 sm:p-8",
          className,
        )}
        {...props}
      >
        <div className="mb-6 flex items-start justify-between gap-6 border-b border-line pb-4">
          <div>
            <DialogPrimitive.Title className="font-display text-2xl leading-tight text-text">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className={cn("mt-1 text-small text-text-muted", !description && "sr-only")}>
              {description ?? title}
            </DialogPrimitive.Description>
          </div>
          <DialogPrimitive.Close
            className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center text-text-muted transition-colors hover:text-text"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export { Dialog, DialogClose, DialogContent, DialogTrigger };
