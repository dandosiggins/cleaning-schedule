import { format } from "date-fns";
import { Check, Clock, MoreVertical, Trash, Edit3, Calendar } from "lucide-react";
import { CleaningTask } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCompleteTask, useDeleteTask, getListTasksQueryKey, getListTasksDueTodayQueryKey, getGetStatsQueryKey, getListUpcomingTasksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { TaskFormDialog } from "./task-form-dialog";

export function TaskCard({ 
  task, 
  showActions = true 
}: { 
  task: CleaningTask; 
  showActions?: boolean;
}) {
  const queryClient = useQueryClient();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  const [isEditing, setIsEditing] = useState(false);

  const handleComplete = () => {
    completeTask.mutate(
      { id: task.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksDueTodayQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListUpcomingTasksQueryKey() });
        }
      }
    );
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this task?")) {
      deleteTask.mutate(
        { id: task.id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListTasksDueTodayQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListUpcomingTasksQueryKey() });
          }
        }
      );
    }
  };

  const isCompleting = completeTask.isPending;

  return (
    <>
      <div className={`p-4 rounded-xl border bg-card text-card-foreground transition-all flex items-start gap-4 hover-elevate ${task.isOverdue ? 'border-destructive/30 bg-destructive/5 shadow-sm' : 'border-border shadow-sm'}`}>
        <button
          onClick={handleComplete}
          disabled={isCompleting}
          className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
            isCompleting ? 'opacity-50 scale-95' : 'hover:bg-primary hover:border-primary text-transparent hover:text-primary-foreground hover:scale-110 active:scale-95'
          }`}
        >
          <Check className="w-4 h-4 opacity-0 transition-opacity hover:opacity-100" strokeWidth={3} />
        </button>

        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex justify-between items-start gap-2">
            <div>
              <h3 className="font-medium text-base leading-tight truncate">{task.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{task.room}</p>
            </div>
            
            <div className="flex items-center gap-2">
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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
              <Clock className="w-3.5 h-3.5" />
              <span className="capitalize">{task.frequency} {task.frequency === 'custom' && task.customIntervalDays ? `(${task.customIntervalDays} days)` : ''}</span>
            </div>
            {task.nextDueAt && (
              <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md ${task.isOverdue ? 'text-destructive bg-destructive/10' : 'text-primary bg-primary/10'}`}>
                <Calendar className="w-3.5 h-3.5" />
                <span>Due {format(new Date(task.nextDueAt), 'MMM d')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {isEditing && (
        <TaskFormDialog 
          task={task} 
          open={isEditing} 
          onOpenChange={setIsEditing} 
        />
      )}
    </>
  );
}