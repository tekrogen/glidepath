import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { User, CreditCard, Bell, Shield, Database, Trash2, Palette } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ConnectedAccountsList } from "@/components/plaid/connected-accounts-list";
import { PlaidLinkButton } from "@/components/plaid/plaid-link-button";
import { DeleteAccountButton } from "@/components/settings/delete-account-button";
import { AppearanceSettings } from "./appearance-settings";
export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/signin?callbackUrl=/settings');
  }

  const user = session.user;
  const userInitials = user.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase() || user.email?.[0]?.toUpperCase() || "U";

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account preferences and application settings
          </p>
        </div>

        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Your account information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
                <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-lg">{user.name || "User"}</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <Badge variant="secondary" className="mt-1">
                  Account
                </Badge>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Full Name</label>
                <input
                  type="text"
                  defaultValue={user.name || ""}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  readOnly
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Managed by your account provider
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Email Address</label>
                <input
                  type="email"
                  defaultValue={user.email || ""}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  readOnly
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Managed by your account provider
                </p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Currency</label>
              <select className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="CAD">CAD - Canadian Dollar</option>
              </select>
            </div>
            <Button>Save Preferences</Button>
          </CardContent>
        </Card>

        {/* Connected Accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Connected Accounts
            </CardTitle>
            <CardDescription>
              Manage your linked bank accounts and financial institutions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ConnectedAccountsList />
              <PlaidLinkButton />
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize how Credit Card Manager looks for you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AppearanceSettings />
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure how you want to receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Budget Alerts</div>
                <div className="text-sm text-gray-500">Get notified when you exceed budget limits</div>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Transaction Notifications</div>
                <div className="text-sm text-gray-500">Receive alerts for new transactions</div>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">AI Insights</div>
                <div className="text-sm text-gray-500">Get personalized financial insights</div>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Monthly Reports</div>
                <div className="text-sm text-gray-500">Receive monthly financial summaries</div>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>
              Manage your account security settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Two-Factor Authentication</div>
                <div className="text-sm text-gray-500">Managed by your account provider</div>
              </div>
              <Badge variant="secondary">Managed</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Password</div>
                <div className="text-sm text-gray-500">Managed by your account provider</div>
              </div>
              <Badge variant="secondary">Managed</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Login Sessions</div>
                <div className="text-sm text-gray-500">Manage active login sessions</div>
              </div>
              <Button variant="outline" size="sm">View Sessions</Button>
            </div>
          </CardContent>
        </Card>

        {/* Data & Privacy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Data & Privacy
            </CardTitle>
            <CardDescription>
              Control your data and privacy preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Tracker Import</div>
                <div className="text-sm text-gray-500">Import cards from your spreadsheet tracker (.xlsx)</div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/cards/import">Import Cards</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Data Export</div>
                <div className="text-sm text-gray-500">Download all your financial data</div>
              </div>
              <Button variant="outline" size="sm">Export Data</Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Data Sharing</div>
                <div className="text-sm text-gray-500">Control how your data is used for insights</div>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-red-600">Delete Account</div>
                <div className="text-sm text-gray-500">
                  Permanently delete your account and all associated data
                </div>
              </div>
              <DeleteAccountButton />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
