import type { ReactNode } from 'react';

export function AccountField({
  label,
  htmlFor,
  description,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  description?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold">
        {label}
      </label>
      {children}
      {description ? (
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/** Maps a 422 `details.fieldErrors` body onto react-hook-form fields. */
export function readServerError(
  error: unknown,
  fallback: string,
): {
  message: string;
  fieldErrors: Record<string, string[] | undefined>;
} {
  const data = (
    error as {
      response?: {
        data?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } };
      };
    }
  ).response?.data;
  return {
    message: data?.message ?? fallback,
    fieldErrors: data?.details?.fieldErrors ?? {},
  };
}
