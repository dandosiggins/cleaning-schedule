import { format } from "date-fns";
import { AlertCircle, Check, Clock, MoreVertical, Trash, Edit3, Calendar, User } from "lucide-react";
import { CleaningTask } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCompleteTask, useDeleteTask, useUncompleteTask, getListTasksQueryKey, getListTasksDueTodayQueryKey, getGetStatsQueryKey, getListUpcomingTasksQueryKey, getListCompletionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { TaskFormDialog } from "./task-form-dialog";

function formatFrequency(task: CleaningTask): string {
  if (task.frequency === "once") return "One time";
  if (task.frequency === "custom" && task.customIntervalDays) {
    return `Custom (${task.customIntervalDays}d)`;
  }
  return task.frequency.charAt(0).toUpperCase() + task.frequency.slice(1);
}

function isTaskChecked(task: CleaningTask): boolean {
  if (!task.lastCompletedAt) return false;
  if (!task.nextDueAt) return true;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return new Date(task.nextDueAt) > endOfToday;
}

export function TaskCard({
  task,
  showActions = true,
}: {
  task: CleaningTask;
  showActions?: boolean;
}) {
  const queryClient = useQueryClient();
  const completeTask = useCompleteTask();
  const uncompleteTask = useUncompleteTask();
  const deleteTask = useDeleteTask();
  const [isEditing, setIsEditing] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksDueTodayQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListUpcomingTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListCompletionsQueryKey() });
  };

  const handleToggleComplete = () => {
    completeTask.reset();
    uncompleteTask.reset();

    if (isTaskChecked(task)) {
      uncompleteTask.mutate({ id: task.id }, { onSuccess: invalidate });
    } else {
      completeTask.mutate({ id: task.id, data: {} }, { onSuccess: invalidate });
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this task?")) {
      deleteTask.mutate({ id: task.id }, { onSuccess: invalidate });
    }
  };

  const isCompleting = completeTask.isPending || uncompleteTask.isPending;
  const isCompleted = isTaskChecked(task);
  const completionError =
    completeTask.error instanceof Error
      ? completeTask.error.message
      : uncompleteTask.error instanceof Error
        ? uncompleteTask.error.message
      : completeTask.error
        ? "Could not complete task."
        : uncompleteTask.error
        ? "Could not complete task."
        : null;

  return (
    <>
      <div className={`p-4 rounded-xl border bg-card text-card-foreground transition-all flex items-start gap-4 hover-elevate ${task.isOverdue ? 'border-destructive/30 bg-destructive/5 shadow-sm' : 'border-border shadow-sm'}`}>
        <button
          onClick={handleToggleComplete}
          disabled={isCompleting}
          aria-label={isCompleted ? "Mark task incomplete" : "Mark task complete"}
          className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
            isCompleted
              ? 'bg-primary border-primary text-primary-foreground'
              : isCompleting
                ? 'opacity-50 scale-95'
                : 'hover:bg-primary hover:border-primary text-transparent hover:text-primary-foreground hover:scale-110 active:scale-95'
          }`}
        >
          <Check className={`w-4 h-4 transition-opacity ${isCompleted ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`} strokeWidth={3} />
        </button>

        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <h3 className="font-medium text-base leading-tight truncate">{task.name}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{task.room}</p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {task.isOverdue && (
                <Badge variant="destructive" className="font-medium text-xs px-2 py-0.5 rounded-md">Overdue</Badge>
              )}
              {showActions && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground hover:text-foreground rounded-full">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 rounded-xl">
                    <DropdownMenuItem onClick={() => setIsEditing(true)} className="cursor-pointer">
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit task
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer" onClick={handleDelete}>
                      <Trash className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatFrequency(task)}</span>
            </div>
            {task.nextDueAt && (
              <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md ${task.isOverdue ? 'text-destructive bg-destructive/10' : 'text-primary bg-primary/10'}`}>
                <Calendar className="w-3.5 h-3.5" />
                <span>Due {format(new Date(task.nextDueAt), 'MMM d')}</span>
              </div>
            )}
            {task.assignedMemberName && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                <User className="w-3.5 h-3.5" />
                <span>{task.assignedMemberName}</span>
              </div>
            )}
            {isCompleted && task.lastCompletedAt && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">
                <Check className="w-3.5 h-3.5" />
                <span>Completed {format(new Date(task.lastCompletedAt), 'MMM d')}</span>
              </div>
            )}
          </div>
          {completionError && (
            <div className="mt-3 flex items-center gap-2 text-xs font-medium text-destructive">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{completionError}</span>
            </div>
          )}
        </div>
      </div>

      {isEditing && (
        <TaskFormDialog task={task} open={isEditing} onOpenChange={setIsEditing} />
      )}
    </>
  );
}
