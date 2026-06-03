"use client";

import { Settings } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";

export default function SettingsButton() {
  const { user, logout } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button className="border border-white bg-black hover:bg-white hover:text-black text-white p-2" title="Settings" />}>
        <Settings className="w-4 h-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {user && (
          <DropdownMenuItem disabled>{`Hello, ${user.email.split("@")[0]}`}</DropdownMenuItem>
        )}
        {user && (
          <DropdownMenuItem render={<a href="/dashboard" />}>
            Dashboard
          </DropdownMenuItem>
        )}
        <DropdownMenuItem render={<a href="/preferences" />}>
          Preferences
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {user ? (
          <DropdownMenuItem onSelect={() => logout()}>Logout</DropdownMenuItem>
        ) : (
          <DropdownMenuItem render={<a href="/login" />}>
            Login
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

