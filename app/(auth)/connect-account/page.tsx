"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import type { PlaidLinkOnEventMetadata, PlaidLinkStableEvent } from "react-plaid-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CreditCard, ExternalLink, Loader2, Shield, XCircle } from "lucide-react";

type Status = "loading" | "consent" | "ready" | "linking" | "exchanging" | "success" | "update-success" | "error";

function ConnectAccountContent() {
  const searchParams = useSearchParams();
  const oauthStateId = searchParams.get("oauth_state_id");
  const isOAuthReturn = !!oauthStateId;
  const itemId = searchParams.get("itemId");
  const isUpdateMode = searchParams.get("mode") === "update" && !!itemId;

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const linkSessionIdRef = useRef<string | null>(null);

  // On OAuth return, retrieve the stored link token; otherwise fetch a new one
  useEffect(() => {
    let cancelled = false;

    if (isOAuthReturn) {
      // Retrieve the link token stored before the OAuth redirect
      const storedToken = sessionStorage.getItem("plaid_link_token");
      if (storedToken && !cancelled) {
        setLinkToken(storedToken);
        setStatus("ready");
      } else if (!cancelled) {
        setError("OAuth session expired. Please try connecting again.");
        setStatus("error");
      }
      return () => { cancelled = true; };
    }

    async function init() {
      try {
        const res = await fetch("/api/plaid/create-link-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemId ? { itemId } : {}),
        });
        if (!res.ok) {
          let msg = `Plaid Link init failed (${res.status})`;
          try {
            const data = await res.json();
            if (data.error) msg = data.error;
          } catch { /* non-JSON response */ }
          throw new Error(msg);
        }
        const data = await res.json();
        if (!cancelled) {
          setLinkToken(data.linkToken);
          // Store for OAuth return
          sessionStorage.setItem("plaid_link_token", data.linkToken);
          // Update mode skips consent (user already consented for this item)
          setStatus(isUpdateMode ? "ready" : "consent");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to initialize");
          setStatus("error");
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, [isOAuthReturn, itemId, isUpdateMode]);

  const onSuccess = useCallback(async (publicToken: string) => {
    if (isUpdateMode) {
      // Update mode: access token is already valid, no exchange needed
      setStatus("update-success");
      sessionStorage.removeItem("plaid_link_token");

      // Notify the parent window to refresh
      if (window.opener) {
        window.opener.postMessage({ type: "plaid-connected" }, window.location.origin);
      }
      try {
        const bc = new BroadcastChannel("plaid-events");
        bc.postMessage({ type: "plaid-connected" });
        bc.close();
      } catch {
        // BroadcastChannel not supported
      }
      return;
    }

    setStatus("exchanging");
    try {
      const res = await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken }),
      });
      if (!res.ok) {
        let msg = "Failed to connect account";
        try {
          const data = await res.json();
          if (data.error) msg = data.error;
        } catch { /* non-JSON response */ }
        throw new Error(msg);
      }
      setStatus("success");
      sessionStorage.removeItem("plaid_link_token");

      // Notify the parent window to refresh
      if (window.opener) {
        window.opener.postMessage({ type: "plaid-connected" }, window.location.origin);
      }
      // BroadcastChannel fallback (works even when window.opener is null)
      try {
        const bc = new BroadcastChannel("plaid-events");
        bc.postMessage({ type: "plaid-connected" });
        bc.close();
      } catch {
        // BroadcastChannel not supported — postMessage is the only path
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setStatus("error");
    }
  }, [isUpdateMode]);

  const onExit = useCallback((err: { error_code: string; error_message: string; error_type: string } | null) => {
    if (err) {
      console.error("Plaid Link exit error:", err);
      setError(`${err.error_type}: ${err.error_code} — ${err.error_message}`);
      setStatus("error");
    } else {
      // User closed Link without error — return to consent or ready
      setStatus(isUpdateMode ? "ready" : "consent");
    }
  }, [isUpdateMode]);

  // Log Link events for conversion tracking and troubleshooting (Plaid dashboard requirement)
  const onEvent = useCallback((eventName: PlaidLinkStableEvent | string, metadata: PlaidLinkOnEventMetadata) => {
    // Capture link_session_id on first event for correlation
    if (metadata.link_session_id && !linkSessionIdRef.current) {
      linkSessionIdRef.current = metadata.link_session_id;
    }

    console.log('[Plaid Link]', eventName, {
      link_session_id: metadata.link_session_id,
      institution_id: metadata.institution_id,
      institution_name: metadata.institution_name,
      error_type: metadata.error_type || undefined,
      error_code: metadata.error_code || undefined,
      error_message: metadata.error_message || undefined,
      view_name: metadata.view_name,
      timestamp: metadata.timestamp,
    });
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit,
    onEvent,
    // On OAuth return, pass the full current URL so Plaid can resume the flow
    ...(isOAuthReturn && {
      receivedRedirectUri: window.location.href,
    }),
  });

  // Auto-open Plaid Link once token is ready
  useEffect(() => {
    if (linkToken && ready && status === "ready") {
      setStatus("linking");
      open();
    }
  }, [linkToken, ready, status, open]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <CreditCard className="h-5 w-5" />
            {isUpdateMode ? "Reconnect Account" : "Connect Account"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Initializing Plaid Link...</p>
            </div>
          )}

          {status === "consent" && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4 text-primary" />
                Data Sharing Disclosure
              </div>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  By connecting your account, you authorize Credit Card Manager to access the
                  following data through Plaid:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Account balances and account details</li>
                  <li>Credit card transaction history</li>
                  
                </ul>
                <p>
                  Your data is encrypted at rest and in transit. Access consent
                  is valid for <strong>1 year</strong> and is refreshed each
                  time you sync. You can disconnect at any time from Settings.
                </p>
              </div>
              <div className="pt-2">
                <a
                  href="https://plaid.com/legal/#end-user-privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Plaid End User Privacy Policy
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <Button
                className="w-full"
                onClick={() => setStatus("ready")}
              >
                Connect Account
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.close()}
              >
                Cancel
              </Button>
            </div>
          )}

          {(status === "ready" || status === "linking") && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isOAuthReturn
                  ? "Completing bank connection..."
                  : "Plaid Link should open automatically."}
              </p>
              {!isOAuthReturn && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { if (ready) open(); }}
                  disabled={!ready}
                >
                  Open Plaid Link Manually
                </Button>
              )}
            </div>
          )}

          {status === "exchanging" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Connecting your account...</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="text-sm font-medium">Account connected successfully!</p>
              <p className="text-xs text-muted-foreground">
                Your accounts and transactions are being synced. You can close this window.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.close()}
              >
                Close Window
              </Button>
            </div>
          )}

          {status === "update-success" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="text-sm font-medium">Account reconnected successfully!</p>
              <p className="text-xs text-muted-foreground">
                Your connection has been restored. Syncing will resume automatically.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.close()}
              >
                Close Window
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm font-medium text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.close()}
              >
                Close Window
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConnectAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ConnectAccountContent />
    </Suspense>
  );
}
