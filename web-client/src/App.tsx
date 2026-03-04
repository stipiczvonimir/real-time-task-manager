import './App.css'
import { useEffect, useState, useRef } from "react";
import * as signalR from "@microsoft/signalr";

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
  const HUB_URL = `${API_BASE}/hubs/tasks`;

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const connectionRef = useRef<signalR.HubConnection | null>(null);

  async function loadTasks() {
    try {
      setError(null);

      const res = await fetch(`${API_BASE}/api/tasks`);
      if (!res.ok) throw new Error("Failed to load tasks");

      const data: TaskItem[] = await res.json();
      setTasks(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  async function startSignalR() {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect()
      .build();

    connection.on("Task created", loadTasks);
    connection.on("Task changed", loadTasks);
    connection.on("Task deleted", loadTasks);

    await connection.start();
    console.log("SignalR connected");

    connectionRef.current = connection;
  }

  useEffect(() => {
    (async () => {
      await loadTasks();
      await startSignalR();
    })();

    return () => {
      connectionRef.current?.stop();
    };
  }, []);


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
