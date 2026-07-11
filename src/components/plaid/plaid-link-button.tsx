"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";

interface PlaidLinkButtonProps {
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  label?: string;
  size?: "default" | "sm" | "lg" | "icon";
}

export function PlaidLinkButton({
  className,
  variant = "outline",
  label = "Connect Bank Account",
  size = "default",
}: PlaidLinkButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Listen for success message from the popup window
  useEffect(() => {
    function onConnected() {
      setLoading(false);
      router.refresh();
    }

    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "plaid-connected") {
        onConnected();
      }
    }
    window.addEventListener("message", handleMessage);

    // BroadcastChannel fallback (works when window.opener is null)
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("plaid-events");
      bc.onmessage = (event) => {
        if (event.data?.type === "plaid-connected") {
          onConnected();
        }
      };
    } catch {
      // BroadcastChannel not supported
    }

    return () => {
      window.removeEventListener("message", handleMessage);
      bc?.close();
    };
  }, [router]);

  const handleClick = useCallback(() => {
    setLoading(true);

    const width = 500;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      "/connect-account",
      "plaid-connect",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    // Reset loading if the popup is closed without connecting
    if (popup) {
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          setLoading(false);
        }
      }, 500);
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <div className={className}>
      <Button
        variant={variant}
        size={size}
        className={size === "default" ? "w-full" : ""}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4 mr-2" />
        )}
        {label}
      </Button>
    </div>
  );
}
