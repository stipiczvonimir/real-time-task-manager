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

type SortKey = "updatedAt" | "createdAt" | "title";
type SortDir = "asc" | "desc";
type SortOption = { key: SortKey; dir: SortDir };

const DEFAULT_SORT: SortOption = { key: "updatedAt", dir: "desc" };

function compare(a: TaskItem, b: TaskItem, opt: SortOption) {
  const { key, dir } = opt;
  let result = 0;

  if (key === "title") {
    result = a.title.localeCompare(b.title);
  } else {
    const ta = Date.parse(a[key]);
    const tb = Date.parse(b[key]);
    result = ta - tb;
  }

  return dir === "asc" ? result : -result;
}

function App() {
  const API_BASE = import.meta.env.VITE_API_BASE as string;
  const hubUrl = useMemo(() => `${API_BASE}/hubs/tasks`, [API_BASE]);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<(typeof STATUSES)[number]>("TODO");

  const [saving, setSaving] = useState(false);

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
      connectionRef.current?.stop().catch(() => { });
      connectionRef.current = null;
      startingRef.current = false;
    };
  }, [loadTasks, startSignalR]);

  const deleteTask = useCallback(async (id: number) => {
    const ok = window.confirm("Delete this task?");
    if (!ok) return;

    try {
      setError(null);

      const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error(`Failed to delete task: ${res.status}`);

    } catch (e: any) {
      setError(e?.message ?? "Failed to delete task");
    }
  }, [API_BASE, loadTasks]);

  const beginEdit = useCallback((t: TaskItem) => {
    setEditingId(t.id);
    setEditTitle(t.title ?? "");
    setEditDescription(t.description ?? "");
    setEditStatus(formatStatus(t.status) as (typeof STATUSES)[number]);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
    setEditStatus("TODO");
  }, []);

  const saveEdit = useCallback(async (id: number) => {
    try {
      setError(null);
      setSaving(true);

      const payload = {
        title: editTitle.trim(),
        description: editDescription.trim() ? editDescription.trim() : null,
        status: editStatus,
      };

      if (!payload.title) throw new Error("Title is required.");

      const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Failed to update task: ${res.status}`);

      await loadTasks();

      cancelEdit();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update task");
    } finally {
      setSaving(false);
    }
  }, [API_BASE, editTitle, editDescription, editStatus, loadTasks, cancelEdit]);

  const [sortByStatus, setSortByStatus] = useState<
    Record<(typeof STATUSES)[number], SortOption>
  >({
    "TODO": DEFAULT_SORT,
    "IN PROGRESS": DEFAULT_SORT,
    "DONE": DEFAULT_SORT,
  });

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

    for (const status of STATUSES) {
      const opt = sortByStatus[status];
      map[status] = [...map[status]].sort((a, b) => compare(a, b, opt));
    }
    return map;
  }, [tasks, sortByStatus]);


  return (
    <div className="app">
      <h1>Tasks</h1>

      {loading && <div>Loading…</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}

      <div className="board">
        {STATUSES.map((status) => (
          <div key={status} className="column">

            <div className="column-header">
              <span>{status} ({grouped[status].length})</span>
              <div className="sort-controls">
                <select
                  className="sort-select"
                  value={sortByStatus[status].key}
                  onChange={(e) =>
                    setSortByStatus((prev) => ({
                      ...prev,
                      [status]: { ...prev[status], key: e.target.value as SortKey },
                    }))
                  }
                >
                  <option value="updatedAt">Updated</option>
                  <option value="createdAt">Created</option>
                  <option value="title">Title</option>
                </select>

                <button
                  type="button"
                  className="sort-dir"
                  onClick={() =>
                    setSortByStatus((prev) => ({
                      ...prev,
                      [status]: {
                        ...prev[status],
                        dir: prev[status].dir === "asc" ? "desc" : "asc",
                      },
                    }))
                  }
                  aria-label="Toggle sort direction"
                  title="Toggle sort direction"
                >
                  {sortByStatus[status].dir === "asc" ? "↑" : "↓"}
                </button>
              </div>
            </div>

            <ul className="task-list">
              {grouped[status].map((t) => {
                const isEditing = editingId === t.id;

                return (
                  <li key={t.id} className="task-card">
                    <div className="task-content">
                      <div className="task-title">{t.title}</div>

                      {!isEditing ? (
                        <>
                          {t.description && <div>{t.description}</div>}
                          <div className="task-meta">Status: {t.status}</div>
                        </>
                      ) : (
                        <div className="task-edit">
                          <input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Title"
                          />

                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder="Description"
                            rows={3}
                          />

                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as any)}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>

                          <div className="task-edit-actions">
                            <button type="button" onClick={cancelEdit}>
                              Cancel
                            </button>

                            <button type="button" onClick={() => saveEdit(t.id)} disabled={saving}>
                              {saving ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="task-actions">
                        <button type="button" onClick={() => beginEdit(t)} disabled={saving}>
                          Edit
                        </button>

                        <button
                          type="button"
                          className="delete"
                          onClick={() => deleteTask(t.id)}
                          disabled={saving}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

          </div>
        ))}
      </div>
    </div>
  );
}

export default App
