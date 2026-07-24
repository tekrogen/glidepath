"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function NewPaymentError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Payment stepper error:", error)
  }, [error])

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Payment scheduling
        </p>
        <h1 className="font-heading text-4xl font-bold tracking-tight">Schedule a payment</h1>
      </div>

      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            We couldn&apos;t load the stepper — your draft, if any, is safe. This may be a
            temporary issue.
          </p>
          <Button onClick={reset}>Try again</Button>
        </CardContent>
      </Card>
    </div>
  )
}
