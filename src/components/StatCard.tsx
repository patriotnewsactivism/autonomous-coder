import { LucideIcon } from "lucide-react";

interface StatItemProps {
  icon: LucideIcon;
  label: string;
  value: number;
  color: "success" | "primary" | "warning" | "destructive";
}

const colorClasses = {
  success: "text-success",
  primary: "text-primary",
  warning: "text-warning",
  destructive: "text-destructive",
};

const StatItem = ({ icon: Icon, label, value, color }: StatItemProps) => {
  return (
    <div className="stat-item flex items-center justify-between py-2 sm:py-2.5">
      <div className="flex items-center gap-2 sm:gap-3">
        <Icon className={`h-3 w-3 sm:h-4 sm:w-4 ${colorClasses[color]}`} />
        <span className="text-xs sm:text-sm text-muted-foreground">{label}</span>
      </div>
      <span className={`text-base sm:text-lg font-semibold ${colorClasses[color]}`} data-testid={`stat-value-${label.toLowerCase()}`}>
        {value}
      </span>
    </div>
  );
};

interface StatCardProps {
  stats: StatItemProps[];
}

const StatCard = ({ stats }: StatCardProps) => {
  return (
    <div className="glass-card rounded-xl border border-border/50 p-4 sm:p-6">
      <div className="mb-3 sm:mb-4 flex items-center gap-2">
        <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-primary animate-pulse" />
        <h3 className="text-base sm:text-lg font-semibold text-foreground">Statistics</h3>
      </div>
      <div className="space-y-0.5 sm:space-y-1">
        {stats.map((stat, index) => (
          <StatItem key={index} {...stat} />
        ))}
      </div>
    </div>
  );
};

export default StatCard;
