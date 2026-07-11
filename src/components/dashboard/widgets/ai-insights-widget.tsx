import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, AlertTriangle, TrendingUp, Lightbulb, Brain } from "lucide-react";
import type { InsightItem } from "@/app/(dashboard)/dashboard/types";

interface AiInsightsWidgetProps {
  items: InsightItem[];
}

const INSIGHT_ICONS: Record<string, typeof Brain> = {
  opportunity: Target,
  warning: AlertTriangle,
  trend: TrendingUp,
  tip: Lightbulb,
};

const INSIGHT_COLORS: Record<string, string> = {
  opportunity: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  trend: "bg-primary/15 text-primary",
  tip: "bg-secondary/15 text-secondary",
};

export function AiInsightsWidget({ items }: AiInsightsWidgetProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Insights</CardTitle>
        <CardDescription className="text-sm">AI-powered spending insights</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No insights yet. As transactions accumulate, personalized insights
            will appear here.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const Icon = INSIGHT_ICONS[item.type] || Brain;
              const colorClass = INSIGHT_COLORS[item.type] || "bg-muted text-muted-foreground";
              return (
                <div key={item.id} className="flex items-start gap-3">
                  <div className={`rounded-full p-1.5 ${colorClass}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{item.title}</span>
                      <Badge
                        variant={item.impact === "high" ? "default" : "secondary"}
                        className="shrink-0 text-xs"
                      >
                        {item.impact}
                      </Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
