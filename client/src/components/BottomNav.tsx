import { Link, useLocation } from "wouter";
import { LayoutDashboard, CalendarDays, Info } from "lucide-react";
import { motion } from "framer-motion";

export function BottomNav() {
  const [location] = useLocation();

  const tabs = [
    { href: "/", label: "Absensi", icon: LayoutDashboard },
    { href: "/recap", label: "Rekap", icon: CalendarDays },
    { href: "/info", label: "Info", icon: Info },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border/50 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around h-16 md:h-20 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const isActive = location === tab.href;
          return (
            <Link key={tab.href} href={tab.href}>
              <div className="relative flex flex-col items-center justify-center w-full h-full cursor-pointer group">
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -top-[1px] w-12 h-1 bg-primary rounded-b-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <tab.icon 
                  className={`w-6 h-6 mb-1 transition-colors duration-200 ${
                    isActive ? "text-primary stroke-[2.5]" : "text-muted-foreground group-hover:text-primary/70"
                  }`} 
                />
                <span className={`text-[10px] md:text-xs font-medium transition-colors duration-200 ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}>
                  {tab.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
