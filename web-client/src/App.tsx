import './App.css';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const hubUrl = useMemo(() => `${API_BASE}/hubs/tasks`, [API_BASE]);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const startingRef = useRef(false);

  const loadTasks = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/tasks`);
      if (!res.ok) throw new Error(`Failed to load tasks: ${res.status}`);

      const data: TaskItem[] = await res.json();
      setTasks(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  const startSignalR = useCallback(async () => {
    if (connectionRef.current || startingRef.current) return;
    startingRef.current = true;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect()
      .build();

    connection.on("Task created", loadTasks);
    connection.on("Task changed", loadTasks);
    connection.on("Task deleted", loadTasks);

    await connection.start();
    connectionRef.current = connection;

    console.log("SignalR connected");
  }, [hubUrl, loadTasks]);

  useEffect(() => {
    (async () => {
      await loadTasks();
      await startSignalR();
    })();

    return () => {
      connectionRef.current?.stop().catch(() => {});
      connectionRef.current = null;
      startingRef.current = false;
    };
  }, [loadTasks, startSignalR]);

  const grouped = useMemo(() => {
    const map: Record<(typeof STATUSES)[number], TaskItem[]> = {
      "TODO": [],
      "IN PROGRESS": [],
      "DONE": [],
    };

    for (const t of tasks) {
      const key = formatStatus(t.status) as (typeof STATUSES)[number];
      (map[key] ?? map["TODO"]).push(t);
    }
    return map;
  }, [tasks]);


  return (
    <div className="app">
  <h1>Tasks</h1>

  {loading && <div>Loading…</div>}
  {error && <div style={{ color: "red" }}>{error}</div>}

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
