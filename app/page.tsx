import Link from "next/link";
import { ArrowRight, CreditCard, LineChart, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

const features = [
  {
    icon: CreditCard,
    title: "Connect your cards",
    description:
      "Link credit cards securely with Plaid. Balances and transactions sync automatically.",
  },
  {
    icon: LineChart,
    title: "See where money goes",
    description:
      "Auto-categorized transactions, spending insights, budgets, and recurring-charge detection.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    description:
      "Access tokens are encrypted at rest and webhooks are cryptographically verified.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="container mx-auto flex items-center justify-between px-6 py-4">
        <Logo />
        <Button asChild variant="outline">
          <Link href="/signin">Sign in</Link>
        </Button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="max-w-3xl font-heading text-4xl font-bold tracking-tight sm:text-6xl">
          Every card. Every charge.{" "}
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            One dashboard.
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          A modern credit card manager powered by Plaid — balances, transaction
          history, spending insights, budgets, and subscription tracking.
        </p>
        <div className="mt-8 flex gap-4">
          <Button asChild size="lg">
            <Link href="/signin">
              View the demo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-20 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="text-left">
              <CardContent className="pt-6">
                <feature.icon className="h-8 w-8 text-primary" />
                <h2 className="mt-4 font-heading text-lg font-semibold">
                  {feature.title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <footer className="container mx-auto px-6 py-6 text-center text-sm text-muted-foreground">
        Credit Card Manager — a Plaid-powered starter kit.
      </footer>
    </div>
  );
}
