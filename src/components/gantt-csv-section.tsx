"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Play, Download, Trash2, AlertCircle } from "lucide-react";
import { KbdShortcut } from "@/components/ui/kbd-shortcut";

interface ParsedTask {
  name: string;
  section: string;
  duration: string;
  durationDays: number;
  start: string;
  end: string;
}

function addBusinessDays(date: Date, days: number, excludeWeekends: boolean): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (excludeWeekends) {
      if (result.getDay() !== 0 && result.getDay() !== 6) added++;
    } else {
      added++;
    }
  }
  return result;
}

function parseMermaidGantt(input: string): { tasks: ParsedTask[]; title: string } {
  const lines = input.split("\n");
  const tasks: ParsedTask[] = [];
  const taskMap: Record<string, Date> = {};
  let currentSection = "Default";
  const excludeWeekends = input.includes("excludes weekends");
  const defaultDate = new Date("2024-01-01");

  let title = "clickup_tasks";
  const titleMatch = input.match(/^\s*title\s+(.+)$/m);
  if (titleMatch) title = titleMatch[1].trim().replace(/\s+/g, "_").toLowerCase();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (
      !line ||
      line.startsWith("gantt") ||
      line.startsWith("title") ||
      line.startsWith("dateFormat") ||
      line.startsWith("axisFormat") ||
      line.startsWith("excludes")
    )
      continue;

    if (line.startsWith("section")) {
      currentSection = line.replace("section", "").trim();
      continue;
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const taskName = line.substring(0, colonIdx).trim();
    const detailPart = line.substring(colonIdx + 1);
    const details = detailPart.split(",").map((s) => s.trim());

    const cleanDetails = details.filter((d) => !["active", "done", "crit"].includes(d));
    if (cleanDetails.length < 2) continue;

    const id = cleanDetails[0];
    const startInfo = cleanDetails[1];
    const durationInfo = cleanDetails[2] || cleanDetails[1];

    const durationMatch = durationInfo.match(/[\d.]+/);
    if (!durationMatch) continue;

    const durationRaw = durationInfo.match(/[\d.]+d/)?.[0] || durationMatch[0] + "d";
    const duration = parseFloat(durationMatch[0]);
    let startDate: Date;

    if (startInfo.includes("after")) {
      const afterId = startInfo.replace("after", "").trim();
      startDate = taskMap[afterId] ? new Date(taskMap[afterId]) : defaultDate;
    } else if (/\d{4}-\d{2}-\d{2}/.test(startInfo)) {
      startDate = new Date(startInfo);
    } else {
      startDate = defaultDate;
    }

    const endDate = addBusinessDays(startDate, duration, excludeWeekends);
    taskMap[id] = endDate;

    tasks.push({
      name: taskName,
      section: currentSection,
      duration: durationRaw,
      durationDays: duration,
      start: startDate.toISOString().split("T")[0],
      end: endDate.toISOString().split("T")[0],
    });
  }

  return { tasks, title };
}

export function GanttCsvSection() {
  const [input, setInput] = useState("");
  const [tasks, setTasks] = useState<ParsedTask[]>([]);
  const [csvTitle, setCsvTitle] = useState("clickup_tasks");
  const [parseError, setParseError] = useState<string | null>(null);
  const [hasParsedOnce, setHasParsedOnce] = useState(false);

  const handleParse = useCallback(() => {
    setParseError(null);
    if (!input.trim()) {
      setParseError("Paste a Mermaid gantt definition above, then hit Parse.");
      return;
    }
    const result = parseMermaidGantt(input);
    if (result.tasks.length === 0) {
      setParseError(
        "No tasks found. Each task needs a name, id, start date or dependency, and duration — e.g. Auth service :auth, 2024-03-01, 5d"
      );
      return;
    }
    setTasks(result.tasks);
    setCsvTitle(result.title);
    setHasParsedOnce(true);
    toast.success(`${result.tasks.length} task${result.tasks.length !== 1 ? "s" : ""} parsed`);
  }, [input]);

  // Cmd/Ctrl+Enter to parse or download
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (tasks.length > 0) handleDownload();
        else handleParse();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.length, input]);

  const handleDownload = useCallback(() => {
    if (tasks.length === 0) return;
    let csvContent = "Task Name,Section,Duration,Start Date,Due Date\n";
    for (const t of tasks) {
      csvContent += `"${t.name}","${t.section}","${t.duration}","${t.start}","${t.end}"\n`;
    }
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${csvTitle}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${csvTitle}.csv downloaded`);
  }, [tasks, csvTitle]);

  const handleClear = useCallback(() => {
    setInput("");
    setTasks([]);
  }, []);

  // Compute timeline bar positions
  const allStarts = tasks.map((t) => new Date(t.start).getTime());
  const allEnds = tasks.map((t) => new Date(t.end).getTime());
  const minDate = Math.min(...allStarts);
  const maxDate = Math.max(...allEnds);
  const totalRange = maxDate - minDate || 1;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Editor */}
      <div>
        <div className="flex items-start sm:items-center justify-between mb-2 gap-2">
          <div className="min-w-0">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mermaid Gantt input</label>
            <p className="text-xs text-muted-foreground/60 mt-0.5 hidden sm:block">
              Paste a Mermaid gantt chart to export as ClickUp-compatible CSV. Supports{" "}
              <code className="font-mono text-primary/80 bg-primary/5 px-1 rounded">after</code>{" "}
              dependencies and weekend exclusion.
            </p>
          </div>
          <span className="font-mono text-xs text-muted-foreground/60 shrink-0">gantt.mmd</span>
        </div>
        <div className="rounded-xl border border-border overflow-hidden transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/10">
          <div className="px-3 py-1.5 bg-secondary border-b border-border">
            <span className="text-xs text-muted-foreground font-mono">mermaid</span>
          </div>
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (parseError) setParseError(null);
            }}
            spellCheck={false}
            placeholder={`gantt\n    title Sprint Plan\n    dateFormat YYYY-MM-DD\n    excludes weekends\n\n    section Backend\n    Auth service    :auth, 2024-03-01, 5d\n    API endpoints   :api, after auth, 3d`}
            className="w-full min-h-[200px] sm:min-h-[320px] p-4 bg-card text-foreground font-mono text-sm leading-relaxed resize-y outline-none placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      {/* Inline error banner */}
      {parseError && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-destructive/20 bg-destructive/5 text-sm text-destructive/80 animate-in fade-in duration-200">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <span>{parseError}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          onClick={handleParse}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold transition-all hover:bg-primary/90"
        >
          <Play className="h-4 w-4" />
          Parse
        </button>
        <button
          onClick={handleDownload}
          disabled={tasks.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-transparent text-muted-foreground border border-border rounded-lg text-sm font-medium transition-all hover:text-foreground hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Download</span> CSV
        </button>
        {input && (
          <button
            onClick={handleClear}
            className="inline-flex items-center gap-2 px-3 py-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
        <span className="ml-auto flex items-center gap-3">
          {tasks.length > 0 && (
            <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {tasks.length} task{tasks.length !== 1 ? "s" : ""}
            </span>
          )}
          <KbdShortcut shortcut="Mod+↵" />
        </span>
      </div>

      {/* Preview table / empty state */}
      <div>
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="text-sm font-semibold text-foreground">Preview</h2>
          {tasks.length > 0 && (
            <span className="font-mono text-xs text-muted-foreground">
              {tasks.length} task{tasks.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="border border-border rounded-xl overflow-hidden">
          {tasks.length > 0 ? (
            <div className="overflow-x-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary">
                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                      Task
                    </th>
                    <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                      Section
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                      Duration
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                      Start
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                      Due
                    </th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border min-w-[160px]">
                      Timeline
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, i) => {
                    const startOffset =
                      ((new Date(task.start).getTime() - minDate) / totalRange) * 100;
                    const barWidth = Math.max(
                      8,
                      ((new Date(task.end).getTime() - new Date(task.start).getTime()) /
                        totalRange) *
                        100
                    );
                    return (
                      <tr
                        key={i}
                        className="border-b border-border/50 last:border-b-0 transition-colors hover:bg-primary/5"
                      >
                        <td className="px-3 sm:px-4 py-3 text-sm text-foreground font-medium whitespace-nowrap">
                          {task.name}
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap">
                          <span className="inline-block px-2.5 py-0.5 bg-secondary border border-border rounded font-mono text-xs text-muted-foreground">
                            {task.section}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 font-mono text-sm text-primary whitespace-nowrap">
                          {task.duration}
                        </td>
                        <td className="px-3 sm:px-4 py-3 font-mono text-sm text-muted-foreground whitespace-nowrap">
                          {task.start}
                        </td>
                        <td className="px-3 sm:px-4 py-3 font-mono text-sm text-muted-foreground whitespace-nowrap">
                          {task.end}
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 min-w-[160px]">
                          <div
                            className="h-2 min-w-[12px] rounded-full bg-primary/40"
                            style={{
                              marginLeft: `${startOffset}%`,
                              width: `${barWidth}%`,
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                {hasParsedOnce
                  ? "No tasks to show. Paste a new chart and hit Parse."
                  : "Paste a Mermaid gantt definition above and hit Parse to preview."}
              </p>
              {!hasParsedOnce && (
                <pre className="font-mono text-xs sm:text-sm text-muted-foreground/70 bg-secondary/50 rounded-lg px-4 py-3 text-left leading-relaxed overflow-x-auto max-w-full">
{`gantt
  title My Project
  section Phase 1
  Task A :a1, 2024-01-01, 5d
  Task B :b1, after a1, 3d`}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
