import './App.css'
import { useEffect, useState } from "react";

type TaskItem = {
  id: number;
  title: string;
  description?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function App() {
  const API_BASE = import.meta.env.VITE_API_BASE as string;

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
  let cancelled = false;

  (async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}/api/tasks`);
      if (!res.ok) throw new Error(`Get /api/tasks failed: ${res.status}`);

      const data: TaskItem[] = await res.json();
      if (!cancelled)
        setTasks(data);
    } catch (e: any) {
      if (!cancelled)
        setError(e?.message ?? "FAiled to load tasks");
    } finally {
      if (!cancelled) setLoading(false);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [API_BASE]);

return (
  <div style={{ maxWidth: 300, margin: "40px auto"}}>
    <h1>Tasks</h1>

    {loading && <div>Loading…</div>}
    {error && <div style={{ color: "red" }}>{error}</div>}

    <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
      {tasks.map((t) => (
        <li key={t.id} style={{ border: "1px solid #fff", borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 700 }}>{t.title}</div>
          {t.description ? <div>{t.description}</div> : null}
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            Status: {t.status} 
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7}}>
            Created: {new Date(t.createdAt).toLocaleString('en-GB',{timeZone: 'CET',})}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7}}>
            Updated: {new Date(t.updatedAt).toLocaleString('en-GB',{timeZone: 'CET',})}
          </div>
        </li>
      ))}
    </ul>
  </div>
);
}

export default App
