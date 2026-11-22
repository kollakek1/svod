import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-3 whitespace-nowrap",
    "rounded-[2px] border border-transparent font-sans font-normal",
    "transition-[background-color,border-color,color,transform] duration-200",
    "disabled:pointer-events-none disabled:opacity-45",
    "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus",
  ],
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-press active:scale-[0.985]",
        outline:
          "border-control-border bg-transparent text-text hover:bg-surface-2 hover:border-line-strong active:scale-[0.985]",
        quiet: "bg-transparent text-text hover:bg-surface-2",
        link: "h-auto rounded-none border-0 bg-transparent p-0 text-text underline decoration-line-strong decoration-1 underline-offset-4 hover:decoration-accent-text",
        danger: "border-danger/40 bg-transparent text-danger hover:bg-danger/10",
      },
      size: {
        lg: "h-14 px-8 text-[0.9375rem] tracking-[0.01em]",
        md: "h-12 px-6 text-sm tracking-[0.01em]",
        sm: "h-10 px-4 text-[0.8125rem] tracking-[0.01em]",
        icon: "h-11 w-11 p-0",
        none: "h-auto p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
