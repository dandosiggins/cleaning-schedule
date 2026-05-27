import { Link, useLocation } from "wouter";
import { CalendarDays, CheckCircle2, Home } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Today", icon: Home },
    { href: "/schedule", label: "Schedule", icon: CalendarDays },
    { href: "/history", label: "History", icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Mobile nav bottom, desktop sidebar */}
      <nav className="md:w-64 border-r border-border bg-card flex-shrink-0 fixed md:sticky bottom-0 w-full z-50 md:h-[100dvh]">
        <div className="flex flex-col h-full">
          <div className="hidden md:flex p-6 items-center gap-3 text-primary font-bold text-xl border-b border-border/50">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span>Tidy Home</span>
          </div>
          
          <div className="flex md:flex-col md:flex-1 md:p-4 gap-1 p-2 justify-around md:justify-start">
            {navItems.map((item) => {
              const active = location === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center md:justify-start justify-center flex-col md:flex-row gap-1 md:gap-3 px-3 py-2 md:py-3 rounded-xl transition-all duration-200 ${
                    active 
                      ? "bg-primary text-primary-foreground font-medium shadow-sm hover-elevate-2 no-default-hover-elevate" 
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5 md:w-5 md:h-5" />
                  <span className="text-xs md:text-base">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-x-hidden pb-20 md:pb-0">
        <div className="max-w-4xl mx-auto p-4 md:p-8 md:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}