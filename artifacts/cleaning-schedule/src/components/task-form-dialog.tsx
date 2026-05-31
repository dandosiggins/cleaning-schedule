import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateTask, useUpdateTask, useListTasks, useListMembers,
  getListTasksQueryKey, getListTasksDueTodayQueryKey, getListUpcomingTasksQueryKey,
  getGetStatsQueryKey, CleaningTask, useGetTask, getGetTaskQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { User } from "lucide-react";

const taskSchema = z.object({
  name: z.string().min(1, "Name is required"),
  room: z.string().min(1, "Room is required"),
  frequency: z.enum(["daily", "weekly", "monthly", "custom"]),
  customIntervalDays: z.coerce.number().min(1).nullable().optional(),
  notes: z.string().nullable().optional(),
  assignedMemberId: z.number().nullable().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: CleaningTask;
}) {
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const { data: allTasks } = useListTasks();
  const { data: members } = useListMembers();

  const { data: fetchedTask } = useGetTask(task?.id || 0, { query: { enabled: !!task?.id, queryKey: getGetTaskQueryKey(task?.id || 0) } });
  const activeTask = fetchedTask || task;

  const [isNewRoom, setIsNewRoom] = useState(false);

  const existingRooms = Array.from(new Set((allTasks || []).map(t => t.room))).filter(Boolean);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      name: activeTask?.name || "",
      room: activeTask?.room || "",
      frequency: activeTask?.frequency || "weekly",
      customIntervalDays: activeTask?.customIntervalDays || null,
      notes: activeTask?.notes || "",
      assignedMemberId: activeTask?.assignedMemberId ?? null,
    }
  });

  const frequency = form.watch("frequency");

  useEffect(() => {
    if (activeTask) {
      form.reset({
        name: activeTask.name,
        room: activeTask.room,
        frequency: activeTask.frequency,
        customIntervalDays: activeTask.customIntervalDays,
        notes: activeTask.notes,
        assignedMemberId: activeTask.assignedMemberId ?? null,
      });
      if (activeTask.room && !existingRooms.includes(activeTask.room)) {
        setIsNewRoom(true);
      }
    } else if (open) {
      form.reset({
        name: "",
        room: "",
        frequency: "weekly",
        customIntervalDays: null,
        notes: "",
        assignedMemberId: null,
      });
      setIsNewRoom(false);
    }
  }, [open, activeTask, form, existingRooms.length]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTasksDueTodayQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListUpcomingTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
  };

  const onSubmit = (values: TaskFormValues) => {
    if (activeTask) {
      updateTask.mutate({ id: activeTask.id, data: values }, { onSuccess: () => { invalidate(); onOpenChange(false); } });
    } else {
      createTask.mutate({ data: values }, { onSuccess: () => { invalidate(); onOpenChange(false); } });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{activeTask ? "Edit Task" : "New Task"}</DialogTitle>
          <DialogDescription>
            {activeTask ? "Update the details of your cleaning task." : "Add a new task to your cleaning schedule."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold text-foreground">Task Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Wipe counters" className="rounded-lg bg-muted/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="room"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold text-foreground">Room</FormLabel>
                  {isNewRoom || existingRooms.length === 0 ? (
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="e.g. Kitchen" className="rounded-lg bg-muted/50" {...field} />
                      </FormControl>
                      {existingRooms.length > 0 && (
                        <Button type="button" variant="outline" className="rounded-lg" onClick={() => setIsNewRoom(false)}>Select</Button>
                      )}
                    </div>
                  ) : (
                    <Select onValueChange={(val) => {
                      if (val === "new_room") { setIsNewRoom(true); field.onChange(""); }
                      else { field.onChange(val); }
                    }} value={existingRooms.includes(field.value) ? field.value : undefined}>
                      <FormControl>
                        <SelectTrigger className="rounded-lg bg-muted/50">
                          <SelectValue placeholder="Select a room" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl">
                        {existingRooms.map(r => (
                          <SelectItem key={r} value={r} className="rounded-lg cursor-pointer">{r}</SelectItem>
                        ))}
                        <SelectItem value="new_room" className="rounded-lg cursor-pointer font-medium text-primary">+ Add new room</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem className={frequency === "custom" ? "col-span-1" : "col-span-2"}>
                    <FormLabel className="font-semibold text-foreground">Frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-lg bg-muted/50">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="daily" className="rounded-lg cursor-pointer">Daily</SelectItem>
                        <SelectItem value="weekly" className="rounded-lg cursor-pointer">Weekly</SelectItem>
                        <SelectItem value="monthly" className="rounded-lg cursor-pointer">Monthly</SelectItem>
                        <SelectItem value="custom" className="rounded-lg cursor-pointer">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {frequency === "custom" && (
                <FormField
                  control={form.control}
                  name="customIntervalDays"
                  render={({ field }) => (
                    <FormItem className="col-span-1">
                      <FormLabel className="font-semibold text-foreground">Days Between</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" placeholder="e.g. 14" className="rounded-lg bg-muted/50" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Assignee picker */}
            {members && members.length > 0 && (
              <FormField
                control={form.control}
                name="assignedMemberId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      Assign To <span className="text-muted-foreground font-normal">(Optional)</span>
                    </FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val === "unassigned" ? null : Number(val))}
                      value={field.value != null ? String(field.value) : "unassigned"}
                    >
                      <FormControl>
                        <SelectTrigger className="rounded-lg bg-muted/50">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="unassigned" className="rounded-lg cursor-pointer text-muted-foreground">Unassigned</SelectItem>
                        {members.map(m => (
                          <SelectItem key={m.id} value={String(m.id)} className="rounded-lg cursor-pointer">{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold text-foreground">Notes <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Special instructions or supplies needed..."
                      className="resize-none rounded-lg bg-muted/50 min-h-[80px]"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4 gap-3">
              <Button type="button" variant="outline" className="rounded-xl px-6" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" className="rounded-xl px-8 font-semibold shadow-md hover-elevate-2 no-default-hover-elevate" disabled={createTask.isPending || updateTask.isPending}>
                {activeTask ? "Save Changes" : "Create Task"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
