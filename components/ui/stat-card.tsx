/**
 * Stat Card Component
 *
 * Displays a statistic with label, value, and optional icon.
 * Used in admin dashboards for displaying metrics.
 */

import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  /** Label describing the statistic */
  label: string;
  /** The numeric or string value to display */
  value: number | string;
  /** Optional icon to display alongside the stat */
  icon?: React.ReactNode;
  /** Optional className for custom styling */
  className?: string;
}

/**
 * A card component for displaying statistics
 *
 * @example
 * ```tsx
 * // Simple usage without icon
 * <StatCard label="Total Users" value={42} />
 *
 * // With icon
 * <StatCard
 *   label="Logins Today"
 *   value={15}
 *   icon={<LoginIcon className="h-5 w-5" />}
 * />
 * ```
 */
export const StatCard = memo(function StatCard({ label, value, icon, className }: StatCardProps) {
  return (
    <Card className={cn(className)}>
      <CardContent className={cn("p-4", icon && "flex items-center gap-4")}>
        {icon && (
          <div className="text-muted-foreground">
            {icon}
          </div>
        )}
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={cn(
            "font-bold text-foreground",
            icon ? "text-xl" : "text-2xl"
          )}>
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
});
