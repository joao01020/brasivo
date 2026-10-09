"use client";

import { UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export const BRASIVO_PROFILE_UPDATED_EVENT = "brasivo:profile-updated";

type UserAvatarProps = {
  avatarUrl?: string | null;
  size?: number;
  className?: string;
  iconSize?: number;
  alt?: string;
};

export default function UserAvatar({
  avatarUrl,
  size = 35,
  className = "",
  iconSize,
  alt = "Foto de perfil",
}: UserAvatarProps) {
  const resolvedIconSize =
    iconSize ?? Math.max(14, Math.round(size * 0.52));

  return (
    <span
      className={`brasivo-user-avatar ${className}`.trim()}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
      }}
      aria-label={avatarUrl ? alt : "Sem foto de perfil"}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={alt}
          className="brasivo-user-avatar-image"
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.style.display = "none";
            const parent = event.currentTarget.parentElement;
            if (parent) parent.dataset.imageFailed = "true";
          }}
        />
      ) : (
        <UserRound
          className="brasivo-user-avatar-fallback"
          size={resolvedIconSize}
          strokeWidth={1.55}
          aria-hidden="true"
        />
      )}

      {avatarUrl && (
        <UserRound
          className="brasivo-user-avatar-error-fallback"
          size={resolvedIconSize}
          strokeWidth={1.55}
          aria-hidden="true"
        />
      )}
    </span>
  );
}

export function useUserAvatarUrl() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const client = createClient();

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      setAvatarUrl(null);
      return;
    }

    const { data, error } = await client
      .from("profiles")
      .select("avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("[BRASIVO avatar] Não foi possível carregar avatar:", error.message);
      return;
    }

    const value =
      typeof data?.avatar_url === "string" && data.avatar_url.trim()
        ? data.avatar_url.trim()
        : null;

    setAvatarUrl(value);
  }, []);

  useEffect(() => {
    void reload();

    const onProfileUpdated = () => void reload();
    const onFocus = () => void reload();

    window.addEventListener(
      BRASIVO_PROFILE_UPDATED_EVENT,
      onProfileUpdated,
    );
    window.addEventListener("focus", onFocus);

    const client = createClient();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      void reload();
    });

    return () => {
      window.removeEventListener(
        BRASIVO_PROFILE_UPDATED_EVENT,
        onProfileUpdated,
      );
      window.removeEventListener("focus", onFocus);
      subscription.unsubscribe();
    };
  }, [reload]);

  return avatarUrl;
}

export function announceBrasivoProfileUpdated() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new Event(BRASIVO_PROFILE_UPDATED_EVENT),
  );
}
