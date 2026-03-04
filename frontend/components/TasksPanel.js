"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../lib/auth";

const priorityColors = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const statusColors = {
  pending: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
};

const typeLabels = {
  proposal_submission: "📄 Proposal",
  budget_review: "💰 Budget",
  logistics: "🚛 Logistics",
  setup: "🔧 Setup",
  general: "📋 General",
};

export default function TasksPanel({ eventId, committeeId, isChair }) {
  const { authFetch, user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", type: "general", priority: "normal", dueDate: "",
  });
  const [creating, setCreating] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (eventId) params.set("eventId", eventId);
      if (committeeId) params.set("committeeId", committeeId);
      const data = await authFetch(`/tasks?${params.toString()}`);
      setTasks(data.tasks || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [authFetch, eventId, committeeId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      await authFetch("/tasks", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          eventId,
          committeeId,
          dueDate: form.dueDate || null,
        }),
      });
      setForm({ title: "", description: "", type: "general", priority: "normal", dueDate: "" });
      setShowForm(false);
      fetchTasks();
    } catch (err) {
      alert("Failed to create task: " + err.message);
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(task) {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    try {
      await authFetch(`/tasks/${task.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      fetchTasks();
    } catch {}
  }

  async function deleteTask(id) {
    if (!confirm("Delete this task?")) return;
    try {
      await authFetch(`/tasks/${id}`, { method: "DELETE" });
      fetchTasks();
    } catch {}
  }

  async function autoCreateTasks() {
    if (!confirm("Create standard tasks for this committee? (Proposal submission, budget, team confirmation, setup)")) return;
    try {
      await authFetch("/tasks/auto-create", {
        method: "POST",
        body: JSON.stringify({ eventId, committeeId }),
      });
      fetchTasks();
    } catch (err) {
      alert("Failed: " + err.message);
    }
  }

  const pending = tasks.filter((t) => t.status !== "completed");
  const completed = tasks.filter((t) => t.status === "completed");

  if (loading) {
    return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-surface-900">
          Tasks & Deadlines ({pending.length} active)
        </h3>
        <div className="flex gap-2">
          {tasks.length === 0 && isChair && (
            <button
              onClick={autoCreateTasks}
              className="text-xs bg-surface-100 hover:bg-surface-200 text-surface-700 px-3 py-1.5 rounded-lg transition-all"
            >
              Auto-create tasks
            </button>
          )}
          {isChair && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="text-xs bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg transition-all"
            >
              {showForm ? "Cancel" : "+ New Task"}
            </button>
          )}
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-surface-50 rounded-xl p-4 space-y-3 border border-surface-200">
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Task title..."
            required
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description (optional)"
            rows={2}
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
          />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-surface-500 font-medium">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full mt-1 rounded-lg border border-surface-200 px-2 py-1.5 text-xs text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30">
                <option value="general">General</option>
                <option value="proposal_submission">Proposal Submission</option>
                <option value="budget_review">Budget Review</option>
                <option value="logistics">Logistics</option>
                <option value="setup">Setup</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-surface-500 font-medium">Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full mt-1 rounded-lg border border-surface-200 px-2 py-1.5 text-xs text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-surface-500 font-medium">Due Date</label>
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full mt-1 rounded-lg border border-surface-200 px-2 py-1.5 text-xs text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
            </div>
          </div>
          <button type="submit" disabled={creating || !form.title.trim()}
            className="bg-brand-500 hover:bg-brand-600 disabled:bg-surface-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all">
            {creating ? "Creating..." : "Create Task"}
          </button>
        </form>
      )}

      {/* Active tasks */}
      {pending.length === 0 && completed.length === 0 ? (
        <div className="text-center py-10 text-surface-400 text-sm">
          No tasks yet. {isChair ? "Click \"Auto-create tasks\" to get started." : "Your team lead will assign tasks."}
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map((task) => {
            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "completed";
            return (
              <div key={task.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                isOverdue ? "border-red-200 bg-red-50/50" : "border-surface-100 hover:border-surface-200"
              }`}>
                <button
                  onClick={() => toggleStatus(task)}
                  className="mt-0.5 w-5 h-5 rounded border-2 border-surface-300 hover:border-brand-400 flex items-center justify-center flex-shrink-0 transition-colors"
                >
                  {task.status === "in_progress" && <div className="w-2 h-2 bg-blue-400 rounded-full" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900">{task.title}</p>
                  {task.description && <p className="text-xs text-surface-400 mt-0.5">{task.description}</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px]">{typeLabels[task.type] || "📋"}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${priorityColors[task.priority]}`}>
                      {task.priority}
                    </span>
                    {task.dueDate && (
                      <span className={`text-[10px] ${isOverdue ? "text-red-600 font-semibold" : "text-surface-400"}`}>
                        📅 {new Date(task.dueDate).toLocaleDateString()}{isOverdue ? " — OVERDUE" : ""}
                      </span>
                    )}
                    {task.assignedTo && (
                      <span className="text-[10px] text-surface-400">→ {task.assignedTo}</span>
                    )}
                  </div>
                </div>
                {isChair && (
                  <button onClick={() => deleteTask(task.id)} className="text-surface-300 hover:text-red-400 transition-colors flex-shrink-0" title="Delete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Completed tasks */}
      {completed.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-surface-400 cursor-pointer hover:text-surface-600">
            {completed.length} completed task{completed.length !== 1 ? "s" : ""}
          </summary>
          <div className="mt-2 space-y-1.5">
            {completed.map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-surface-100 opacity-60">
                <button onClick={() => toggleStatus(task)}
                  className="w-5 h-5 rounded border-2 border-green-400 bg-green-400 flex items-center justify-center flex-shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </button>
                <p className="text-sm text-surface-500 line-through">{task.title}</p>
                {isChair && (
                  <button onClick={() => deleteTask(task.id)} className="ml-auto text-surface-300 hover:text-red-400">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
