"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <h1 className="text-xl font-semibold">Something broke on our side</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-dim">
        {error.message.includes("provider") || error.message.includes("Ubisoft")
          ? "The upstream stats service is not responding. Cached data may still be available — try again in a minute."
          : "An unexpected error occurred. It has been logged."}
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-xl bg-gradient-to-r from-accent to-accent-hot px-5 py-2.5 text-sm font-semibold text-bg"
      >
        Try again
      </button>
    </div>
  );
}
