import { CleaningTask, useListTasks, useListUpcomingTasks } from "@workspace/api-client-react";
import { TaskCard } from "@/components/task-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, LayoutGrid, Clock, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { TaskFormDialog } from "@/components/task-form-dialog";
import { addDays, addMonths, differenceInCalendarDays, format, startOfDay } from "date-fns";

function toTaskArray(data: unknown): CleaningTask[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const value = data as { tasks?: unknown; data?: unknown };
    if (Array.isArray(value.tasks)) return value.tasks as CleaningTask[];
    if (Array.isArray(value.data)) return value.data as CleaningTask[];
  }
  return [];
}

function formatFrequency(task: CleaningTask): string {
  if (task.frequency === "once") return "One time";
  if (task.frequency === "custom" && task.customIntervalDays) {
    return `Every ${task.customIntervalDays} days`;
  }
  return task.frequency.charAt(0).toUpperCase() + task.frequency.slice(1);
}

function isCompletedOneTimeTask(task: CleaningTask): boolean {
  return task.frequency === "once" && Boolean(task.lastCompletedAt) && !task.nextDueAt;
}

function advanceTaskDate(date: Date, task: CleaningTask): Date | null {
  if (task.frequency === "once") return null;
  if (task.frequency === "daily") return addDays(date, 1);
  if (task.frequency === "weekly") return addDays(date, 7);
  if (task.frequency === "monthly") return addMonths(date, 1);
  if (task.frequency === "custom" && task.customIntervalDays) {
    return addDays(date, task.customIntervalDays);
  }
  return addDays(date, 7);
}

type PrintTaskOccurrence = {
  task: CleaningTask;
  dueDate: Date;
};

function getWeeklyOccurrences(task: CleaningTask, today: Date, weekEnd: Date): PrintTaskOccurrence[] {
  if (!task.nextDueAt || isCompletedOneTimeTask(task)) return [];

  let dueDate = startOfDay(new Date(task.nextDueAt));
  if (Number.isNaN(dueDate.getTime())) return [];

  if (task.frequency === "once") {
    if (dueDate < today || dueDate > weekEnd) return [];
    return [{ task, dueDate }];
  }

  while (dueDate < today) {
    const nextDate = advanceTaskDate(dueDate, task);
    if (!nextDate || nextDate <= dueDate) return [];
    dueDate = nextDate;
  }

  const occurrences: PrintTaskOccurrence[] = [];
  while (dueDate <= weekEnd) {
    occurrences.push({ task, dueDate });
    const nextDate = advanceTaskDate(dueDate, task);
    if (!nextDate || nextDate <= dueDate) break;
    dueDate = nextDate;
  }

  return occurrences;
}

function WeeklyPrintSchedule({ tasks }: { tasks: CleaningTask[] }) {
  const today = startOfDay(new Date());
  const weekEnd = startOfDay(addDays(today, 6));
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(today, index));
  const activeTasks = tasks.filter((task) => !isCompletedOneTimeTask(task));
  const sortedTasks = [...activeTasks].sort((a, b) => {
    const aDue = a.nextDueAt ? new Date(a.nextDueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.nextDueAt ? new Date(b.nextDueAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;
    return a.name.localeCompare(b.name);
  });
  const tasksWithDueDates = sortedTasks
    .filter((task) => task.nextDueAt)
    .sort((a, b) => new Date(a.nextDueAt ?? 0).getTime() - new Date(b.nextDueAt ?? 0).getTime());

  const overdueTasks = tasksWithDueDates.filter((task) => new Date(task.nextDueAt ?? 0) < today);
  const weeklyOccurrences = sortedTasks.flatMap((task) => getWeeklyOccurrences(task, today, weekEnd));
  const weeklyTaskIds = new Set(weeklyOccurrences.map((occurrence) => occurrence.task.id));
  overdueTasks.forEach((task) => weeklyTaskIds.add(task.id));
  const otherTasks = sortedTasks.filter((task) => !weeklyTaskIds.has(task.id));

  return (
    <section className="print-weekly-schedule hidden">
      <header className="print-header">
        <div>
          <h1>Weekly Cleaning Schedule</h1>
          <p>
            {format(today, "MMMM d")} - {format(addDays(today, 6), "MMMM d, yyyy")}
          </p>
        </div>
        <span>{activeTasks.length} open tasks</span>
      </header>

      {overdueTasks.length > 0 && (
        <section className="print-overdue">
          <h2>Overdue</h2>
          <div className="print-task-list">
            {overdueTasks.map((task) => (
              <div key={`print-overdue-${task.id}`} className="print-task-row">
                <span className="print-checkbox" />
                <div>
                  <strong>{task.name}</strong>
                  <p>
                    {task.room} - Due {format(new Date(task.nextDueAt ?? ""), "EEE, MMM d")}
                    {task.assignedMemberName ? ` - ${task.assignedMemberName}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="print-week-grid">
        {weekDays.map((day) => {
          const dayOccurrences = weeklyOccurrences.filter((occurrence) => (
            differenceInCalendarDays(occurrence.dueDate, day) === 0
          ));

          return (
            <section key={day.toISOString()} className="print-day">
              <h2>{format(day, "EEEE")}</h2>
              <p>{format(day, "MMM d")}</p>
              {dayOccurrences.length === 0 ? (
                <div className="print-empty">No scheduled tasks</div>
              ) : (
                <div className="print-task-list">
                  {dayOccurrences.map(({ task, dueDate }) => (
                    <div key={`print-${task.id}-${dueDate.toISOString()}`} className="print-task-row">
                      <span className="print-checkbox" />
                      <div>
                        <strong>{task.name}</strong>
                        <p>
                          {task.room} - {formatFrequency(task)}
                          {task.assignedMemberName ? ` - ${task.assignedMemberName}` : ""}
                        </p>
                        {task.notes && <p className="print-notes">{task.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {otherTasks.length > 0 && (
        <section className="print-other-tasks">
          <h2>Other Tasks</h2>
          <div className="print-task-list print-other-task-list">
            {otherTasks.map((task) => (
              <div key={`print-other-${task.id}`} className="print-task-row">
                <span className="print-checkbox" />
                <div>
                  <strong>{task.name}</strong>
                  <p>
                    {task.room} - {formatFrequency(task)}
                    {task.nextDueAt ? ` - Due ${format(new Date(task.nextDueAt), "MMM d")}` : " - No due date"}
                    {task.assignedMemberName ? ` - ${task.assignedMemberName}` : ""}
                  </p>
                  {task.notes && <p className="print-notes">{task.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

export default function SchedulePage() {
  const { data: tasksData, isLoading } = useListTasks();
  const { data: upcomingTasksData, isLoading: isUpcomingLoading } = useListUpcomingTasks();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const tasks = useMemo(() => toTaskArray(tasksData), [tasksData]);
  const upcomingTasks = useMemo(() => toTaskArray(upcomingTasksData), [upcomingTasksData]);
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeUpcomingTasks = Array.isArray(upcomingTasks) ? upcomingTasks : [];

  const groupedTasks = useMemo(() => {
    return safeTasks.reduce((acc, task) => {
      if (!acc[task.room]) {
        acc[task.room] = [];
      }
      acc[task.room].push(task);
      return acc;
    }, {} as Record<string, CleaningTask[]>);
  }, [safeTasks]);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Full Schedule</h1>
          <p className="text-muted-foreground mt-2 text-xl font-medium">Manage all your household routines.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={() => window.print()} disabled={isLoading} className="gap-2 rounded-xl h-12 px-6 font-semibold">
            <Printer className="w-5 h-5" strokeWidth={2.5} />
            <span>Print Week</span>
          </Button>
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2 rounded-xl h-12 px-6 font-semibold shadow-md hover-elevate-2 no-default-hover-elevate">
            <Plus className="w-5 h-5" strokeWidth={2.5} />
            <span>Add Task</span>
          </Button>
        </div>
      </header>

      <WeeklyPrintSchedule tasks={safeTasks} />

      {/* Upcoming Section */}
      <div className="space-y-5 print:hidden">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Clock className="w-6 h-6 text-primary" />
          Upcoming (Next 7 Days)
        </h2>
        {isUpcomingLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : safeUpcomingTasks.length === 0 ? (
          <div className="bg-card/30 border border-border/40 rounded-2xl p-6 text-center text-muted-foreground">
            No tasks due in the next 7 days.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            {safeUpcomingTasks.map((task) => (
              <TaskCard key={`upcoming-${task.id}`} task={task} />
            ))}
          </div>
        )}
      </div>

      <hr className="border-border/60 print:hidden" />

      <div className="space-y-8 mt-8 print:hidden">
        <h2 className="text-2xl font-bold text-foreground">All Tasks</h2>
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-8 w-40 rounded-lg" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : safeTasks.length === 0 ? (
          <div className="text-center py-24 px-4 border-2 border-dashed border-border rounded-3xl bg-card/40 shadow-sm mt-12">
            <div className="w-20 h-20 bg-secondary rounded-3xl flex items-center justify-center mx-auto mb-6">
              <LayoutGrid className="w-10 h-10 text-secondary-foreground" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-3">No tasks defined</h3>
            <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">Start building your cleaning routine by adding your first task.</p>
            <Button onClick={() => setIsCreateOpen(true)} className="rounded-xl h-12 px-8 font-semibold text-lg">Add your first task</Button>
          </div>
        ) : (
          Object.entries(groupedTasks).map(([room, roomTasks]) => (
            <div key={room} className="space-y-5 bg-card/50 p-5 md:p-8 rounded-3xl border border-border/60 shadow-sm">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-foreground">{room}</h2>
                <span className="text-xs font-semibold text-muted-foreground bg-background border px-3 py-1 rounded-lg shadow-sm">
                  {roomTasks.length} {roomTasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                {roomTasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="print:hidden">
        <TaskFormDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      </div>
    </div>
  );
}
