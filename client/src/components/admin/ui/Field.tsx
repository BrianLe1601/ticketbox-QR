import { useEffect, useId, useRef, type ComponentPropsWithRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface FieldProps {
  label: ReactNode;
  /** Render-prop receives ids so the control is labelled and described correctly. */
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
}

/** Label above, control, then hint or error. Errors are announced and linked to the control. */
export function Field({ label, children, hint, error, required, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("adm-field", Boolean(error) && "is-invalid", className)}>
      <label className="adm-field-label" htmlFor={id}>
        {label}{required && <span className="adm-field-required" aria-hidden="true"> *</span>}
        {required && <span className="sr-only"> (bắt buộc)</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && <p id={hintId} className="adm-field-hint">{hint}</p>}
      {error && <p id={errorId} className="adm-field-error" role="alert">{error}</p>}
    </div>
  );
}

export function Input({ className, invalid, ...rest }: ComponentPropsWithRef<"input"> & { invalid?: boolean }) {
  return <input className={cn("adm-control adm-input", className)} aria-invalid={invalid || undefined} {...rest} />;
}

export function Textarea({ className, invalid, ...rest }: ComponentPropsWithRef<"textarea"> & { invalid?: boolean }) {
  return <textarea className={cn("adm-control adm-textarea", className)} aria-invalid={invalid || undefined} {...rest} />;
}

/** Native select: accessible and readable everywhere, styled to match. */
export function Select({ className, invalid, children, ...rest }: ComponentPropsWithRef<"select"> & { invalid?: boolean }) {
  return <select className={cn("adm-control adm-select", className)} aria-invalid={invalid || undefined} {...rest}>{children}</select>;
}

/** Native checkbox with tri-state support (header "select all"). */
export function Checkbox({ indeterminate = false, className, ref: externalRef, ...rest }: Omit<ComponentPropsWithRef<"input">, "type"> & { indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  const setRef = (node: HTMLInputElement | null) => {
    ref.current = node;
    if (typeof externalRef === "function") externalRef(node);
    else if (externalRef) externalRef.current = node;
  };
  return <input ref={setRef} type="checkbox" className={cn("adm-checkbox", className)} aria-checked={indeterminate ? "mixed" : undefined} {...rest} />;
}
