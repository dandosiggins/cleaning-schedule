import { useState } from "react";
import { useListMembers, useCreateMember, useDeleteMember, useListTasks, getListMembersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Trash2, Plus } from "lucide-react";

export default function PeoplePage() {
  const queryClient = useQueryClient();
  const { data: members, isLoading } = useListMembers();
  const { data: allTasks } = useListTasks();
  const createMember = useCreateMember();
  const deleteMember = useDeleteMember();
  const [newName, setNewName] = useState("");

  const taskCountByMember = (memberId: number) =>
    (allTasks ?? []).filter(t => t.assignedMemberId === memberId).length;

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    createMember.mutate({ data: { name } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
        setNewName("");
      },
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Remove ${name} from the household? Their tasks will become unassigned.`)) {
      deleteMember.mutate({ id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() }),
      });
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">People</h1>
        <p className="text-muted-foreground mt-2 text-xl font-medium">Manage who's in your household.</p>
      </header>

      {/* Add member */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Add a household member
          </h2>
          <div className="flex gap-3">
            <Input
              placeholder="e.g. Alex"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              className="rounded-xl bg-muted/50 flex-1"
              maxLength={60}
            />
            <Button
              onClick={handleAdd}
              disabled={!newName.trim() || createMember.isPending}
              className="rounded-xl px-6 font-semibold shadow-md hover-elevate-2 no-default-hover-elevate"
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Members list */}
      <div className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </>
        ) : members?.length === 0 ? (
          <div className="text-center py-16 px-4 border-2 border-dashed border-border rounded-3xl bg-card/40 shadow-sm">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No members yet</h3>
            <p className="text-muted-foreground">Add household members above, then assign tasks to them.</p>
          </div>
        ) : (
          members?.map(member => {
            const count = taskCountByMember(member.id);
            return (
              <div key={member.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card shadow-sm hover-elevate">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold text-base">
                    {member.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{member.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {count === 0 ? "No tasks assigned" : `${count} ${count === 1 ? "task" : "tasks"} assigned`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full h-9 w-9 flex-shrink-0"
                  onClick={() => handleDelete(member.id, member.name)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
