import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function AccountsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>

      {/* 3-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2/3: Net Worth + Account Groups */}
        <div className="space-y-6 lg:col-span-2">
          {/* Net Worth Card */}
          <Card>
            <CardHeader className="pb-3">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-40" />
            </CardContent>
          </Card>

          {/* Account Groups */}
          {Array.from({ length: 3 }).map((_, g) => (
            <div key={g} className="space-y-3">
              <Skeleton className="h-5 w-36" />
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </div>

        {/* Right 1/3: Summary */}
        <Card className="h-fit">
          <CardHeader>
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
