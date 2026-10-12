import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 border border-transparent font-medium whitespace-nowrap transition-colors duration-150 outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-accent text-white hover:bg-accent-hover hover:text-white",
        primary: "bg-accent text-white hover:bg-accent-hover hover:text-white",
        dark: "bg-ink text-white hover:bg-ink-2 hover:text-white",
        outline: "border-ink bg-surface text-ink hover:bg-ink hover:text-white",
        ghost: "text-ink hover:bg-sunken hover:text-ink",
        subtle:
          "border-line-strong bg-surface text-ink hover:border-ink hover:text-ink",
        destructive:
          "bg-accent text-white hover:bg-accent-hover hover:text-white",
        link: "text-navy underline-offset-4 hover:text-accent hover:underline",
      },
      size: {
        default: "px-4 py-[9px] text-ui",
        sm: "px-3 py-1.5 text-[12.5px]",
        lg: "px-6 py-[13px] text-ui",
        icon: "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  mono = false,
  asChild = false,
  href,
  type,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    href?: React.ComponentProps<typeof Link>["href"];
    mono?: boolean;
  }) {
  const classes = cn(
    buttonVariants({ variant, size }),
    mono && "font-mono tracking-label",
    className,
  );

  if (asChild) {
    return (
      <Slot.Root
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={classes}
        {...props}
      >
        {children}
      </Slot.Root>
    );
  }

  if (href !== undefined) {
    return (
      <Link
        href={href}
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={classes}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type ?? "button"}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={classes}
      {...props}
    >
      {children}
    </button>
  );
}

export { Button, buttonVariants };
