"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface KbdProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

const Kbd = React.forwardRef<HTMLDivElement, KbdProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Kbd.displayName = "Kbd";

export interface KbdGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

const KbdGroup = React.forwardRef<HTMLDivElement, KbdGroupProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex items-center gap-1", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
KbdGroup.displayName = "KbdGroup";

export { Kbd, KbdGroup };

