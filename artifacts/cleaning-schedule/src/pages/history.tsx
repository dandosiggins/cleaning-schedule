import { useListCompletions } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Calendar } from "lucide-react";

export default function HistoryPage() {
  const { data: completions, isLoading } = useListCompletions({ limit: 50 });

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">History</h1>
        <p className="text-muted-foreground mt-2 text-xl font-medium">A log of your recent accomplishments.</p>
      </header>

      <div className="bg-card rounded-3xl border border-border/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : completions?.length === 0 ? (
          <div className="text-center py-24 px-4">
            <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-3">No history yet</h3>
            <p className="text-lg text-muted-foreground">Complete some tasks to see them logged here.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {completions?.map((completion) => (
              <div key={completion.id} className="p-5 md:p-6 flex items-center gap-5 transition-colors hover:bg-muted/30">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-primary" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-semibold text-foreground truncate">{completion.taskName}</h4>
                  <p className="text-base text-muted-foreground font-medium">{completion.room}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center justify-end gap-2 text-sm font-semibold text-foreground mb-1">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>{format(new Date(completion.completedAt), 'MMM d, yyyy')}</span>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {format(new Date(completion.completedAt), 'h:mm a')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}