const API_BASE = "http://localhost:5138";
const TASKS_API = `${API_BASE}/api/tasks`;
const HUB_URL = `${API_BASE}/hubs/tasks`;

const tasksBody = document.getElementById("tasksBody");
const titleEl = document.getElementById("title");
const descEl = document.getElementById("description");
const statusEl = document.getElementById("status");
const addBtn = document.getElementById("addBtn");

function escapeHtml(s) {
  return (s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function formatStatus(status) {
  if (!status) return "";

  switch (status) {
    case "TODO":
      return "To do";
    case "InProgress":
      return "In progress";
    case "Done":
      return "Done";
    default:
      return status;
  }
}

function formatDate(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);
  const now = new Date();

  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
  }

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  }

  return date.toLocaleDateString("en-GB");
}

function getStatusClass(status) {
  switch (status) {
    case "TODO":
      return "badge-todo";
    case "InProgress":
      return "badge-inprogress";
    case "Done":
      return "badge-done";
    default:
      return "badge-todo";
  }
}

function parseStatusInput(input) {
  if (!input) return null;

  const s = input.trim().toLowerCase();
  if (s === "todo" || s === "to do") return "TODO";
  if (s === "inprogress" || s === "in progress") return "InProgress";
  if (s === "done") return "Done";

  return null;
}

async function loadTasks() {
  const res = await fetch(TASKS_API);
  if (!res.ok) {
    const txt = await res.text();
    tasksBody.innerHTML = `<tr><td colspan="7">Failed to load tasks: ${escapeHtml(txt)}</td></tr>`;
    return;
  }

  const tasks = await res.json();

  tasksBody.innerHTML = tasks.map(t => `
  <tr>
    <td>${t.id}</td>
    <td>${escapeHtml(t.title)}</td>
    <td>${escapeHtml(t.description ?? "")}</td>
    <td>
      <span class="badge ${getStatusClass(t.status)}">
        ${escapeHtml(formatStatus(t.status))}
      </span>
    </td>
    <td class="muted">${formatDate(t.createdAt)}</td>
    <td class="muted">${formatDate(t.updatedAt)}</td>
    <td>
      <button onclick="editTask(${t.id})">Edit</button>
      <button onclick="deleteTask(${t.id})">Delete</button>
    </td>
  </tr>
`).join("");
}

addBtn.addEventListener("click", async () => {
  const payload = {
    title: titleEl.value.trim(),
    description: descEl.value.trim(),
    status: statusEl.value
  };

  const res = await fetch(TASKS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    alert(await res.text());
    return;
  }

  titleEl.value = "";
  descEl.value = "";
  statusEl.value = "TODO";

  await loadTasks();
});

window.deleteTask = async (id) => {
  const res = await fetch(`${TASKS_API}/${id}`, { method: "DELETE" });
  if (!res.ok) alert(await res.text());
};

window.editTask = async (id) => {
  const newTitle = prompt("New title (leave blank to keep unchanged):");
  const newDesc = prompt("New description (leave blank to keep unchanged):");
  const newStatus = prompt("New status (TODO/InProgress/Done) (leave blank to keep unchanged):");

  const payload = {};
  if (newTitle !== null && newTitle !== "") payload.title = newTitle.trim();
  if (newDesc !== null && newDesc !== "") payload.description = newDesc.trim();

  if (newStatus !== null && newStatus.trim() !== "") {
    const parsed = parseStatusInput(newStatus);
    if (!parsed) {
      alert("Invalid status. Use To do, In progress, or Done.");
      return;
    }
    payload.status = parsed;
  }

  if (Object.keys(payload).length === 0) return;

  const res = await fetch(`${TASKS_API}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) alert(await res.text());
};

async function startSignalR() {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL)
    .withAutomaticReconnect()
    .build();

  connection.on("Task changed", () => loadTasks());
  connection.on("Task deleted", () => loadTasks());

  await connection.start();
  console.log("SignalR connected");
}

(async function main() {
  await loadTasks();
  await startSignalR();
})();