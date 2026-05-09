"use client";

import { LogOutIcon, SettingsIcon, StoreIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";

export interface UserMenuProps {
  ownerName: string;
  ownerEmail: string;
  storeName: string;
  storeSlug: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function UserMenu({
  ownerName,
  ownerEmail,
  storeName,
  storeSlug,
}: UserMenuProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success("Sessão encerrada.");
            router.push("/entrar");
            router.refresh();
          },
        },
      });
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full bg-primary/10 text-primary hocus:bg-primary/15"
          aria-label={`Conta de ${ownerName}`}
        >
          <span className="text-xs font-semibold">{getInitials(ownerName)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
        <DropdownMenuLabel className="space-y-0.5 py-2">
          <p className="truncate text-sm font-medium text-foreground">
            {storeName}
          </p>
          <p className="truncate text-xs font-normal text-muted-foreground">
            {ownerEmail}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/${storeSlug}`} target="_blank" rel="noopener noreferrer">
            <StoreIcon className="size-4" /> Ver minha loja
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/configuracoes">
            <SettingsIcon className="size-4" /> Configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            handleSignOut();
          }}
          disabled={isPending}
          variant="destructive"
        >
          <LogOutIcon className="size-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
