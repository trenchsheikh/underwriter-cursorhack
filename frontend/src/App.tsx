import { useEffect, useState } from "react";

export default function App() {
  const [status, setStatus] = useState<string>("…");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setStatus(data.status ?? "unknown"))
      .catch(() => setStatus("unreachable"));
  }, []);

  return (
    <main>
      <h1>underwriter-cursorhack</h1>
      <p>
        Backend health: <strong>{status}</strong>
      </p>
    </main>
  );
}
