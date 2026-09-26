"use client";

import Link from "next/link";

import UserAvatar, {
  useUserAvatarUrl,
} from "@/components/account/UserAvatar";

export default function DashboardUserAvatar() {
  const avatarUrl = useUserAvatarUrl();

  return (
    <Link
      href="/settings#perfil"
      className="dashboard-welcome-avatar-link"
      title="Alterar foto de perfil"
      aria-label="Abrir configurações da foto de perfil"
    >
      <UserAvatar
        avatarUrl={avatarUrl}
        size={38}
        iconSize={18}
        className="brasivo-dashboard-welcome-avatar"
        alt="Sua foto de perfil"
      />
    </Link>
  );
}
