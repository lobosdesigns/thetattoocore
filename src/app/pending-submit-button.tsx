"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

type PendingSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  pendingChildren?: ReactNode;
  pendingLabel?: string;
};

export function PendingSubmitButton({
  children,
  className,
  disabled,
  pendingChildren,
  pendingLabel = "Working",
  ...props
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      aria-busy={pending}
      className={`${className ?? ""} ttc-disabled-state`}
      disabled={disabled || pending}
      style={{
        WebkitTextFillColor: "currentColor",
        ...props.style,
      }}
      type={props.type ?? "submit"}
    >
      {pending && pendingChildren ? (
        pendingChildren
      ) : pending ? (
        <span className="flex items-center justify-center gap-2">
          <LoaderCircle className="size-4 animate-spin" />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
