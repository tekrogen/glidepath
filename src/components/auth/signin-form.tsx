"use client";

/**
 * Sign In Form
 *
 * OAuth buttons for the providers that are configured, plus a demo-account
 * card (with one-click autofill) when demo auth is enabled.
 */

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleIcon, GitHubIcon } from "@/lib/icons";
import { getAuthErrorMessage } from "@/lib/auth/messages";

// Public demo credentials — must match lib/auth/providers.ts and prisma/seed.ts
const DEMO_EMAIL = "demo@glidepath.cards";
const DEMO_PASSWORD = "demo-password";

interface SignInFormProps {
  callbackUrl: string;
  error?: string;
  providers: {
    google: boolean;
    github: boolean;
    demo: boolean;
  };
  /** Registered OAuth host when it differs from the request host (issue #15). */
  oauthMismatchHost?: string | null;
}

export function SignInForm({ callbackUrl, error, providers, oauthMismatchHost }: SignInFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<"google" | "github" | "demo" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const hasOAuth = providers.google || providers.github;

  const handleOAuthSignIn = async (provider: "google" | "github") => {
    setIsLoading(provider);
    try {
      await signIn(provider, { callbackUrl });
    } catch {
      setIsLoading(null);
    }
  };

  const handleDemoSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading("demo");
    setFormError(null);
    try {
      // redirect: false — failures surface inline instead of navigating to a
      // NEXTAUTH_URL-derived error page, which is unreachable when testing
      // from another device on the LAN (issue #11).
      const result = await signIn("demo-credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setFormError(getAuthErrorMessage(result.error) ?? "Sign-in failed. Check your email and password.");
        setIsLoading(null);
      } else if (result?.ok) {
        router.push(callbackUrl);
        router.refresh();
      } else {
        setFormError("Sign-in failed. Please try again.");
        setIsLoading(null);
      }
    } catch {
      setFormError("Sign-in failed. Please try again.");
      setIsLoading(null);
    }
  };

  const autofillDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
  };

  const errorMessage = formError ?? getAuthErrorMessage(error);

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="space-y-4 p-6">
        {errorMessage && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        {providers.google && (
          <Button
            variant="outline"
            className="h-12 w-full justify-center gap-3"
            onClick={() => handleOAuthSignIn("google")}
            disabled={isLoading !== null}
          >
            {isLoading === "google" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <GoogleIcon className="h-5 w-5" />
            )}
            <span className="font-medium">
              {isLoading === "google" ? "Signing in..." : "Continue with Google"}
            </span>
          </Button>
        )}

        {providers.github && (
          <Button
            variant="outline"
            className="h-12 w-full justify-center gap-3"
            onClick={() => handleOAuthSignIn("github")}
            disabled={isLoading !== null}
          >
            {isLoading === "github" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <GitHubIcon className="h-5 w-5" />
            )}
            <span className="font-medium">
              {isLoading === "github" ? "Signing in..." : "Continue with GitHub"}
            </span>
          </Button>
        )}

        {hasOAuth && oauthMismatchHost && (
          <p className="text-xs text-muted-foreground" data-testid="oauth-host-hint">
            Google/GitHub sign-in only works at{" "}
            <span className="font-medium">{oauthMismatchHost}</span> — from this
            device, use the demo credentials below.
          </p>
        )}

        {providers.demo && (
          <>
            {hasOAuth && (
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or try the demo
                  </span>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              <p className="font-medium text-foreground">Try the demo account</p>
              <p className="mt-1 text-muted-foreground">
                Explore a fully populated dashboard — seeded cards, transactions,
                budgets, and insights.
              </p>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-sm"
                onClick={autofillDemo}
                disabled={isLoading !== null}
              >
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Fill in demo credentials
              </Button>
            </div>

            <form onSubmit={handleDemoSignIn} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="demo-email">Email</Label>
                <Input
                  id="demo-email"
                  type="email"
                  placeholder={DEMO_EMAIL}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading !== null}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="demo-password">Password</Label>
                <Input
                  id="demo-password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading !== null}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading !== null}
              >
                {isLoading === "demo" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Sign in
              </Button>
            </form>
          </>
        )}

        {!hasOAuth && !providers.demo && (
          <p className="text-center text-sm text-muted-foreground">
            No sign-in providers are configured. Set ENABLE_DEMO_AUTH=true or add
            Google/GitHub OAuth credentials in your .env file — see SETUP.md.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
