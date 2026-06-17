import { useListTasksDueToday, useGetStats, useListUpcomingTasks } from "@workspace/api-client-react";
import type { CleaningTask } from "@workspace/api-client-react";
import { TaskCard } from "@/components/task-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, ListTodo, AlertCircle, CalendarClock } from "lucide-react";
import { useMemo } from "react";
import { format, parseISO } from "date-fns";

function toTaskArray(data: unknown): CleaningTask[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const value = data as { tasks?: unknown; data?: unknown };
    if (Array.isArray(value.tasks)) return value.tasks as CleaningTask[];
    if (Array.isArray(value.data)) return value.data as CleaningTask[];
  }
  return [];
}

export default function TodayPage() {
  const { data: tasksData, isLoading: isLoadingTasks } = useListTasksDueToday();
  const { data: stats, isLoading: isLoadingStats } = useGetStats();
  const { data: upcomingTasksData, isLoading: isLoadingUpcoming } = useListUpcomingTasks();

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
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Today's Schedule</h1>
        <p className="text-muted-foreground mt-2 text-xl font-medium">Your calm companion for household upkeep.</p>
      </header>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20 shadow-none rounded-2xl overflow-hidden">
          <CardContent className="p-5 flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
              <ListTodo className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Due Today</p>
              {isLoadingStats ? <Skeleton className="h-8 w-12 mt-1" /> : (
                <p className="text-3xl font-bold text-foreground mt-0.5">{stats?.dueTodayCount || 0}</p>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-destructive/5 border-destructive/20 shadow-none rounded-2xl overflow-hidden">
          <CardContent className="p-5 flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-destructive/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Overdue</p>
              {isLoadingStats ? <Skeleton className="h-8 w-12 mt-1" /> : (
                <p className="text-3xl font-bold text-foreground mt-0.5">{stats?.overdueCount || 0}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden hover-elevate">
          <CardContent className="p-5 flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Done This Week</p>
              {isLoadingStats ? <Skeleton className="h-8 w-12 mt-1" /> : (
                <p className="text-3xl font-bold text-foreground mt-0.5">{stats?.completedThisWeek || 0}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-8">
        {isLoadingTasks ? (
          <div className="space-y-6">
            <Skeleton className="h-8 w-40 rounded-lg" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : safeTasks.length === 0 ? (
          <div className="text-center py-20 px-4 border-2 border-dashed border-border rounded-3xl bg-card/40 mt-12 shadow-sm">
            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-12">
              <CheckCircle2 className="w-10 h-10 text-primary -rotate-12" strokeWidth={2.5} />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-3">All caught up!</h3>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">You have no tasks due today. Enjoy your tidy home and take some time to relax.</p>
          </div>
        ) : (
          Object.entries(groupedTasks).map(([room, roomTasks]) => (
            <div key={room} className="space-y-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
                {room}
                <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                  {roomTasks.length} {roomTasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roomTasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Coming Up Soon */}
      {(isLoadingUpcoming || safeUpcomingTasks.length > 0) && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
            <CalendarClock className="w-5 h-5 text-muted-foreground" />
            Coming Up Soon
            <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-md">next 7 days</span>
          </h2>
          {isLoadingUpcoming ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : (
            <div className="space-y-2">
              {safeUpcomingTasks.map(task => (
                <Card key={task.id} className="bg-card border-border shadow-none rounded-xl">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{task.name}</p>
                      <p className="text-sm text-muted-foreground">{task.room} · {task.frequency}</p>
                    </div>
                    {task.nextDueAt && (
                      <span className="shrink-0 text-sm font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
                        {format(parseISO(task.nextDueAt), "EEE, MMM d")}
                      </span>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
