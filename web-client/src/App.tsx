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

const STATUSES = ["TODO", "IN PROGRESS", "DONE"] as const;

function formatStatus(s: string) {
  const v = (s ?? "").trim().toUpperCase();
  if (v === "IN_PROGRESS" || v === "IN-PROGRESS") return "IN PROGRESS";
  return v;
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

  const grouped: Record<string, TaskItem[]> = {
    "TODO": [],
    "IN PROGRESS": [],
    "DONE": [],
  };

  for (const t of tasks) {
    const key = formatStatus(t.status);
    (grouped[key] ?? grouped["TODO"]).push(t);
  }


  return (
    <div className="app">
  <h1>Tasks</h1>

  <div className="board">
    {STATUSES.map((status) => (
      <div key={status} className="column">

        <div className="column-header">
          <span>{status}</span>
          <span> {grouped[status].length}</span>
        </div>

        <ul className="task-list">
          {grouped[status].map((t) => (
            <li key={t.id} className="task-card">
              <div className="task-title">{t.title}</div>

              {t.description && <div>{t.description}</div>}

              <div className="task-meta">
                Status: {t.status}
              </div>
            </li>
          ))}
        </ul>

      </div>
    ))}
  </div>
</div>
  );
}

export default App
