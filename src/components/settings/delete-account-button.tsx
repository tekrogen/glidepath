"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2 } from "lucide-react";

const CONFIRMATION_WORD = "DELETE";

export function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = confirmation === CONFIRMATION_WORD;

  function handleOpenChange(value: boolean) {
    if (deleting) return;
    setOpen(value);
    if (!value) {
      setConfirmation("");
      setError(null);
    }
  }

  async function handleDelete() {
    if (!isConfirmed) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch("/api/user/profile", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete account");
      }

      // Account deleted — sign out and redirect to home
      await signOut({ callbackUrl: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setDeleting(false);
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Delete your account permanently"
      >
        Delete Account
      </Button>

      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account and all associated data
              including connected accounts, transactions, and preferences. All
              Plaid connections will be revoked. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label
              htmlFor="delete-confirmation"
              className="text-sm font-medium"
            >
              Type <span className="font-mono font-bold">{CONFIRMATION_WORD}</span> to confirm
            </label>
            <Input
              id="delete-confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={CONFIRMATION_WORD}
              disabled={deleting}
              autoComplete="off"
              aria-label={`Type ${CONFIRMATION_WORD} to confirm account deletion`}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!isConfirmed || deleting}
              aria-label="Confirm account deletion"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Everything
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
