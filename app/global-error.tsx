"use client";

/** Last-resort boundary for errors in the root layout itself. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#09080f", color: "#f4f3f8", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Scriptly.ai is having trouble loading</h1>
          <p style={{ color: "#a19db4", fontSize: 14, lineHeight: 1.6 }}>Please refresh the page. If the problem continues, try again in a few minutes.</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 20, padding: "10px 18px", borderRadius: 8, border: 0, background: "#7c3aed", color: "#fff", fontSize: 14, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
