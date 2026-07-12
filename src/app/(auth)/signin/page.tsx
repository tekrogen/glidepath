/**
 * Sign In Page
 *
 * Server component: determines which providers are configured and renders
 * the sign-in form. OAuth buttons only appear for configured providers;
 * the demo-credentials card appears when ENABLE_DEMO_AUTH is on.
 */

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { Logo } from "@/components/ui/logo";
import { SignInForm } from "@/components/auth/signin-form";
import { oauthMismatchHost } from "@/lib/auth/messages";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl = "/overview", error } = await searchParams;

  const session = await auth();
  if (session?.user) {
    redirect(callbackUrl);
  }

  const providers = {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    demo: process.env.ENABLE_DEMO_AUTH === "true",
  };

  // OAuth providers only redirect to the registered host (issue #15) —
  // warn instead of letting the buttons fail silently on LAN/other hosts.
  const requestHost = (await headers()).get("host");
  const registeredHost = oauthMismatchHost(requestHost, process.env.NEXTAUTH_URL);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container mx-auto flex items-center px-6 py-4">
        <Logo />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Welcome back
            </h1>
            <p className="mt-2 text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>

          <SignInForm
          callbackUrl={callbackUrl}
          error={error}
          providers={providers}
          oauthMismatchHost={registeredHost}
        />

          <div className="mt-4 text-center">
            <Link
              href="/"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
