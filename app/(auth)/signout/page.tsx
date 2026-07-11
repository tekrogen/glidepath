/**
 * Sign Out Page
 *
 * Confirmation page for signing out.
 * Provides cancel option and handles sign-out action.
 */

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { SignOutForm } from "./signout-form";

export default async function SignOutPage() {
  // Check if user is signed in
  const session = await auth();

  if (!session?.user) {
    redirect("/signin");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Sign out
          </h1>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to sign out?
          </p>
        </div>

        <SignOutForm userName={session.user.name ?? session.user.email ?? "User"} />
      </div>
    </div>
  );
}
