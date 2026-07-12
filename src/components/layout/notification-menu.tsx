"use client";

/**
 * Header notification bell + panel (issue #25). A thin shell over the
 * persisted notification feed: rows mark read on click, the X dismisses.
 * All figures arrive pre-formatted as strings — no derivation here.
 */
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dismissNotification } from "@/features/notifications/actions/dismiss-notification";
import { markNotificationRead } from "@/features/notifications/actions/mark-notification-read";
import type { NotificationDTO, NotificationPanel } from "@/features/notifications";

/** "just now" / "5m" / "3h" / "2d" — display-only, client clock. */
function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function NotificationRow({
  notification,
  onRead,
  onDismiss,
}: {
  notification: NotificationDTO;
  onRead: (n: NotificationDTO) => void;
  onDismiss: (n: NotificationDTO) => void;
}) {
  return (
    <div
      className="flex items-start gap-1 rounded-sm px-1 py-1.5 hover:bg-accent/50"
      data-testid="notification-row"
      data-id={notification.id}
      data-read={notification.read ? "true" : "false"}
    >
      <button
        type="button"
        className="min-w-0 flex-1 px-1 text-left"
        onClick={() => onRead(notification)}
      >
        <span className="flex items-baseline gap-2">
          {!notification.read && (
            <span className="h-1.5 w-1.5 flex-shrink-0 self-center rounded-full bg-primary" aria-hidden />
          )}
          <span className={`truncate text-sm ${notification.read ? "" : "font-medium"}`}>
            {notification.title}
          </span>
          <span className="ml-auto flex-shrink-0 text-xs text-muted-foreground">
            {relativeTime(notification.createdAt)}
          </span>
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
          {notification.body}
        </span>
      </button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 flex-shrink-0 p-0 text-muted-foreground hover:text-foreground"
        aria-label={`Dismiss: ${notification.title}`}
        onClick={() => onDismiss(notification)}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function NotificationMenu({ panel }: { panel: NotificationPanel }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { notifications, unreadCount } = panel;

  const onRead = (n: NotificationDTO) => {
    if (n.read) return;
    startTransition(async () => {
      await markNotificationRead(n.id);
      router.refresh();
    });
  };

  const onDismiss = (n: NotificationDTO) => {
    startTransition(async () => {
      await dismissNotification(n.id);
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative"
          aria-label={`Notifications (${unreadCount} unread)`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            Nothing needs attention.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <NotificationRow key={n.id} notification={n} onRead={onRead} onDismiss={onDismiss} />
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
