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

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStatus, setNewStatus] = useState<(typeof STATUSES)[number]>("TODO");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<(typeof STATUSES)[number]>("TODO");

  const [saving, setSaving] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmDeleteTitle, setConfirmDeleteTitle] = useState<string>("");

  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const startingRef = useRef(false);

  const loadTasks = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/tasks`);
      if (!res.ok) throw new Error(`Failed to load tasks: ${res.status}`);

      const data: TaskItem[] = await res.json();

      const normalized = data.map(t => ({
        ...t,
        status:
          t.status === "InProgress" ? "IN_PROGRESS" :
            t.status === "Done" ? "DONE" :
              "TODO"
      }));

      setTasks(normalized);
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

  const createTask = useCallback(async () => {
    try {
      setError(null);
      setCreating(true);

      const payload = {
        title: newTitle.trim(),
        description: newDescription.trim() ? newDescription.trim() : null,
        status: newStatus,
      };

      if (!payload.title) throw new Error("Title is required.");

      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Failed to create task: ${res.status}`);

      await loadTasks();

      setNewTitle("");
      setNewDescription("");
      setNewStatus("TODO");
      setShowCreate(false);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create task");
    } finally {
      setCreating(false);
    }
  }, [API_BASE, newTitle, newDescription, newStatus, loadTasks]);

  const deleteTask = useCallback(async (id: number) => {
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

  const openDeleteConfirm = useCallback((t: TaskItem) => {
    setConfirmDeleteId(t.id);
    setConfirmDeleteTitle(t.title);
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setConfirmDeleteId(null);
    setConfirmDeleteTitle("");
  }, []);


  return (
    <div className="app">
      <div className="app-header">
        <h1>Tasks</h1>

        <button
          type="button"
          className="primary"
          onClick={() => setShowCreate((v) => !v)}
          disabled={creating || saving}
        >
          {showCreate ? "Close" : "Add task"}
        </button>
      </div>

      {showCreate && (
        <div className="create-card">
          <div className="create-form">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title"
            />

            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description"
              rows={3}
            />

            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as any)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <div className="create-actions">
              <button
                type="button"
                className='cancel-btn'
                onClick={() => {
                  setShowCreate(false);
                  setNewTitle("");
                  setNewDescription("");
                  setNewStatus("TODO");
                }}
                disabled={creating}
              >
                Cancel
              </button>

              <button
                type="button"
                className='create-btn'
                onClick={createTask}
                disabled={creating}
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                        <button type="button" onClick={() => beginEdit(t)} disabled={saving || creating}>
                          Edit
                        </button>

                        <button
                          type="button"
                          className="delete"
                          onClick={() => openDeleteConfirm(t)}
                          disabled={saving || creating}
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
      {confirmDeleteId !== null && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDeleteConfirm();
          }}
        >
          <div className="modal">
            <div className="modal-header" id="delete-title">
              Delete task?
            </div>

            <div className="modal-body">
              Are you sure you want to delete <strong>{confirmDeleteTitle}</strong>?
              <div className="modal-hint">This can’t be undone.</div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={closeDeleteConfirm}
                disabled={saving || creating}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn-danger"
                onClick={async () => {
                  if (confirmDeleteId == null) return;
                  await deleteTask(confirmDeleteId);
                  closeDeleteConfirm();
                }}
                disabled={saving || creating}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App
