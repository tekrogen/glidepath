"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  Building2,
  LinkIcon,
  Loader2,
  RefreshCw,
  Trash2,
  Unlink,
} from "lucide-react";

interface PlaidItemData {
  id: string;
  itemId: string;
  institutionId: string | null;
  institutionName: string | null;
  status: string;
  lastSyncedAt: string | null;
  errorCode: string | null;
  createdAt: string;
}

type ConfirmAction = {
  item: PlaidItemData;
  type: "disconnect" | "delete";
};

function statusBadge(status: string) {
  switch (status) {
    case "ACTIVE":
      return <Badge variant="default">Active</Badge>;
    case "LOGIN_REQUIRED":
      return <Badge variant="destructive">Login Required</Badge>;
    case "PENDING_EXPIRATION":
      return <Badge variant="secondary">Expiring Soon</Badge>;
    case "DISCONNECTED":
      return <Badge variant="outline">Disconnected</Badge>;
    case "REVOKED":
      return <Badge variant="destructive">Revoked</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function ConnectedAccountsList() {
  const router = useRouter();
  const [items, setItems] = useState<PlaidItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/plaid/items");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
      }
    } catch {
      // Silently fail — items list just stays empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Refetch when a new account is connected (via popup postMessage or BroadcastChannel)
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "plaid-connected") {
        fetchItems();
      }
    }
    window.addEventListener("message", handleMessage);

    // BroadcastChannel fallback (works when window.opener is null)
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("plaid-events");
      bc.onmessage = (event) => {
        if (event.data?.type === "plaid-connected") {
          fetchItems();
        }
      };
    } catch {
      // BroadcastChannel not supported — postMessage is the only path
    }

    return () => {
      window.removeEventListener("message", handleMessage);
      bc?.close();
    };
  }, [fetchItems]);

  const handleSync = useCallback(
    async (itemId: string) => {
      setSyncing(itemId);
      try {
        await fetch(`/api/plaid/sync/${itemId}`, { method: "POST" });
        router.refresh();
        await fetchItems();
      } catch {
        // Error handling in the API
      } finally {
        setSyncing(null);
      }
    },
    [router, fetchItems]
  );

  const handleReconnect = useCallback((itemId: string) => {
    const width = 500;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    window.open(
      `/connect-account?itemId=${itemId}&mode=update`,
      "plaid-connect",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );
  }, []);

  const handleDisconnect = useCallback(
    async (itemId: string) => {
      setActing(itemId);
      setConfirm(null);
      try {
        await fetch(`/api/plaid/items/${itemId}`, { method: "PATCH" });
        router.refresh();
        await fetchItems();
      } catch {
        // Error handling in the API
      } finally {
        setActing(null);
      }
    },
    [router, fetchItems]
  );

  const handleDelete = useCallback(
    async (itemId: string) => {
      setActing(itemId);
      setConfirm(null);
      try {
        await fetch(`/api/plaid/items/${itemId}`, { method: "DELETE" });
        router.refresh();
        await fetchItems();
      } catch {
        // Error handling in the API
      } finally {
        setActing(null);
      }
    },
    [router, fetchItems]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-muted/30">
        <p className="text-sm text-muted-foreground text-center">
          No accounts connected yet. Connect your first account to start
          syncing your financial data automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between p-4 border rounded-lg"
        >
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium">
                {item.institutionName || "Connected Account"}
              </div>
              <div className="text-xs text-muted-foreground">
                {item.lastSyncedAt
                  ? `Last synced ${new Date(item.lastSyncedAt).toLocaleDateString()}`
                  : "Never synced"}
              </div>
              {item.errorCode && (
                <div className="flex items-center gap-1 text-xs text-destructive mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {item.errorCode}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge(item.status)}
            {item.status === "ACTIVE" ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSync(item.id)}
                  disabled={syncing === item.id || acting === item.id}
                  title="Sync now"
                >
                  {syncing === item.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirm({ item, type: "disconnect" })}
                  disabled={acting === item.id}
                  title="Disconnect (keep data)"
                >
                  <Unlink className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleReconnect(item.id)}
                title="Reconnect"
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirm({ item, type: "delete" })}
              disabled={acting === item.id}
              title="Delete connection and all data"
            >
              {acting === item.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 text-destructive" />
              )}
            </Button>
          </div>
        </div>
      ))}

      {/* Disconnect confirmation */}
      <Dialog
        open={confirm?.type === "disconnect"}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Disconnect {confirm?.item.institutionName || "account"}?
            </DialogTitle>
            <DialogDescription>
              This will stop syncing new data from this connection. Your
              existing accounts and transactions will be kept.
              You can reconnect later through Plaid Link.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => confirm && handleDisconnect(confirm.item.id)}
              disabled={acting === confirm?.item.id}
            >
              {acting === confirm?.item.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4 mr-2" />
              )}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={confirm?.type === "delete"}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {confirm?.item.institutionName || "account"} and all data?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete all synced data from this connection
              including accounts and transactions. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirm && handleDelete(confirm.item.id)}
              disabled={acting === confirm?.item.id}
            >
              {acting === confirm?.item.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete All Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
