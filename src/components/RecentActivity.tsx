import { Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface ActivityItem {
  id: string;
  type: "success" | "error" | "pending";
  message: string;
  time: string;
}

interface RecentActivityProps {
  activities: ActivityItem[];
}

const activityIcons = {
  success: CheckCircle,
  error: AlertCircle,
  pending: Loader2,
};

const activityColors = {
  success: "text-success",
  error: "text-destructive",
  pending: "text-warning",
};

const RecentActivity = ({ activities }: RecentActivityProps) => {
  return (
    <div className="glass-card rounded-xl border border-border/50 p-6">
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
      </div>
      
      {activities.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          No recent activity
        </p>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => {
            const Icon = activityIcons[activity.type];
            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 rounded-lg bg-muted/30 p-3"
              >
                <Icon
                  className={`h-4 w-4 mt-0.5 ${activityColors[activity.type]} ${
                    activity.type === "pending" ? "animate-spin" : ""
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{activity.message}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RecentActivity;
