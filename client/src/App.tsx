import { useEffect, useState } from "react";

const App = () => {
  const [health, setHealth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("http://localhost:3000/health", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then((r) => setHealth(r.status))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.status);
      });

    return () => controller.abort();
  }, []);

  return (
    <div>
      <h1>This is homepage</h1>
      <p>Health: {error ? `Error: ${error}` : (health ?? "Loading...")}</p>
    </div>
  );
};

export default App;
