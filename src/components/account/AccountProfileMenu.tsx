"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import UserAvatar, {
  useUserAvatarUrl,
} from "@/components/account/UserAvatar";

type AccountProfileMenuProps = {
  displayName: string;
  email: string;
  onOpenChange?: (open: boolean) => void;
};

export default function AccountProfileMenu({
  displayName,
  email,
  onOpenChange,
}: AccountProfileMenuProps) {
  const router = useRouter();
  const avatarUrl = useUserAvatarUrl();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  function setMenuOpen(value: boolean) {
    setOpen(value);
    onOpenChange?.(value);
  }

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div
      className="dashboard-menu-anchor brasivo-account-menu-anchor"
      ref={anchorRef}
    >
      <button
        className={`dashboard-profile-button ${open ? "is-open" : ""}`}
        type="button"
        aria-label="Abrir perfil"
        aria-expanded={open}
        onClick={() => setMenuOpen(!open)}
      >
        <UserAvatar
          avatarUrl={avatarUrl}
          size={35}
          iconSize={18}
          className="brasivo-account-header-avatar"
          alt="Sua foto de perfil"
        />

        <span className="dashboard-profile-copy">
          <strong>{displayName}</strong>
          <small>Minha conta</small>
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="brasivo-account-menu-backdrop"
            aria-label="Fechar menu da conta"
            onClick={() => setMenuOpen(false)}
          />

          <div
            className="profile-popover brasivo-account-popover"
            role="dialog"
            aria-label="Perfil"
          >
            <div className="brasivo-account-popover-user">
              <UserAvatar
                avatarUrl={avatarUrl}
                size={38}
                iconSize={20}
                className="brasivo-account-popover-avatar"
                alt="Sua foto de perfil"
              />

              <div className="brasivo-account-popover-copy">
                <strong>{displayName}</strong>
                <span>{email}</span>
              </div>
            </div>

            <Link
              className="profile-popover-settings"
              href="/settings#perfil"
              onClick={() => setMenuOpen(false)}
            >
              <Settings size={16} />
              <span>Configurações</span>
            </Link>

            <div className="profile-popover-separator" />

            <button type="button" onClick={logout}>
              <LogOut size={16} />
              <span>Sair da conta</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
