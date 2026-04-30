export const dynamic = "force-static";

/**
 * Marker page so Next.js has a root route. The real interface is the API:
 *   POST /api/run             — SSE diligence run
 *   GET  /api/memo/[runId]    — IC memo for a completed run
 *   POST /api/amend           — draft an amendment to MANDATE.md
 *   GET  /api/health          — liveness probe
 */
export default function HomePage() {
  return (
    <main style={{ fontFamily: "ui-monospace, monospace", padding: "2rem", lineHeight: 1.6 }}>
      <h1>UnderWriter — Backend</h1>
      <p>Autonomous underwriting backend. The frontend is in <code>../front-end</code>.</p>
      <ul>
        <li><code>POST /api/run</code> — SSE diligence run</li>
        <li><code>GET  /api/memo/[runId]</code> — IC memo</li>
        <li><code>POST /api/amend</code> — propose mandate amendment</li>
        <li><code>GET  /api/health</code> — liveness probe</li>
      </ul>
    </main>
  );
}
