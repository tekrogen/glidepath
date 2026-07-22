import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function NewPaymentLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 border-b border-border pb-6">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-10 w-64" />
      </div>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-32 rounded-full" />
          ))}
        </div>
        <Card>
          <CardContent className="space-y-4 pt-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
