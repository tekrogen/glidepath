"use client";

/**
 * Sign Out Form
 *
 * Client component for sign-out confirmation with cancel option.
 */

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

interface SignOutFormProps {
  userName: string;
}

export function SignOutForm({ userName }: SignOutFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    await signOut({ callbackUrl: "/" });
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <LogOut className="h-6 w-6 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-sm text-muted-foreground">
          You are currently signed in as{" "}
          <span className="font-medium text-foreground">{userName}</span>
        </p>
      </CardContent>
      <CardFooter className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          variant="default"
          className="flex-1"
          onClick={handleSignOut}
          disabled={isLoading}
        >
          {isLoading ? "Signing out..." : "Sign out"}
        </Button>
      </CardFooter>
    </Card>
  );
}
