"use client";

import { Camera, Check, LoaderCircle, Trash2, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import UserAvatar, {
  announceBrasivoProfileUpdated,
} from "@/components/account/UserAvatar";

const BUCKET = "profile-avatars";
const OBJECT_NAME = "avatar";
const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export default function ProfileAvatarEditor() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"success" | "error">("success");

  useEffect(() => {
    let active = true;

    (async () => {
      const client = createClient();
      const {
        data: { user },
      } = await client.auth.getUser();

      if (!active) return;

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await client
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;

      const value =
        typeof data?.avatar_url === "string" && data.avatar_url.trim()
          ? data.avatar_url.trim()
          : null;

      setAvatarUrl(value);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function showStatus(message: string, kind: "success" | "error") {
    setStatus(message);
    setStatusKind(kind);
  }

  function chooseFile() {
    inputRef.current?.click();
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      showStatus("Use uma imagem JPG, PNG ou WEBP.", "error");
      return;
    }

    if (file.size > MAX_BYTES) {
      showStatus("A foto deve ter no máximo 3 MB.", "error");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    const nextPreview = URL.createObjectURL(file);
    setPreviewUrl(nextPreview);
    setSelectedFile(file);
    setStatus(null);
  }

  async function saveAvatar() {
    if (!selectedFile) {
      chooseFile();
      return;
    }

    setBusy(true);
    setStatus(null);

    try {
      const client = createClient();
      const {
        data: { user },
      } = await client.auth.getUser();

      if (!user) {
        showStatus("Sua sessão expirou. Entre novamente.", "error");
        return;
      }

      const objectPath = `${user.id}/${OBJECT_NAME}`;

      const { error: uploadError } = await client.storage
        .from(BUCKET)
        .upload(objectPath, selectedFile, {
          cacheControl: "3600",
          contentType: selectedFile.type,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicData } = client.storage
        .from(BUCKET)
        .getPublicUrl(objectPath);

      const publicUrl = `${publicData.publicUrl}?v=${Date.now()}`;

      const { error: profileError } = await client
        .from("profiles")
        .update({
          avatar_url: publicUrl,
        })
        .eq("user_id", user.id);

      if (profileError) {
        throw profileError;
      }

      setAvatarUrl(publicUrl);
      setSelectedFile(null);

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      announceBrasivoProfileUpdated();
      showStatus("Foto de perfil atualizada.", "success");
    } catch (error) {
      console.error("[BRASIVO avatar] upload", error);
      showStatus("Não foi possível atualizar a foto de perfil.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeAvatar() {
    setBusy(true);
    setStatus(null);

    try {
      const client = createClient();
      const {
        data: { user },
      } = await client.auth.getUser();

      if (!user) {
        showStatus("Sua sessão expirou. Entre novamente.", "error");
        return;
      }

      const objectPath = `${user.id}/${OBJECT_NAME}`;

      await client.storage
        .from(BUCKET)
        .remove([objectPath])
        .catch(() => undefined);

      const { error } = await client
        .from("profiles")
        .update({
          avatar_url: null,
        })
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      setAvatarUrl(null);
      setSelectedFile(null);

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      announceBrasivoProfileUpdated();
      showStatus("Foto removida.", "success");
    } catch (error) {
      console.error("[BRASIVO avatar] remove", error);
      showStatus("Não foi possível remover a foto.", "error");
    } finally {
      setBusy(false);
    }
  }

  const visibleUrl = previewUrl ?? avatarUrl;

  return (
    <div className="settings-avatar-editor">
      <div className="settings-avatar-preview">
        {loading ? (
          <span className="settings-avatar-loading">
            <LoaderCircle size={19} className="is-spinning" />
          </span>
        ) : (
          <UserAvatar
            avatarUrl={visibleUrl}
            size={72}
            iconSize={31}
            alt="Sua foto de perfil"
          />
        )}

        <button
          type="button"
          className="settings-avatar-camera"
          onClick={chooseFile}
          disabled={busy}
          aria-label="Escolher foto de perfil"
          title="Escolher foto"
        >
          <Camera size={14} />
        </button>
      </div>

      <div className="settings-avatar-copy">
        <strong>Foto de perfil</strong>
        <p>
          Essa foto aparece no cabeçalho, no menu da conta e no seu dashboard.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onFileChange}
          hidden
        />

        <div className="settings-avatar-actions">
          <button
            type="button"
            className="settings-avatar-button"
            onClick={selectedFile ? saveAvatar : chooseFile}
            disabled={busy}
          >
            {busy ? (
              <LoaderCircle size={14} className="is-spinning" />
            ) : selectedFile ? (
              <Check size={14} />
            ) : (
              <Upload size={14} />
            )}
            {selectedFile ? "Salvar foto" : "Escolher foto"}
          </button>

          {(avatarUrl || selectedFile) && (
            <button
              type="button"
              className="settings-avatar-remove"
              onClick={removeAvatar}
              disabled={busy}
            >
              <Trash2 size={13} />
              Remover
            </button>
          )}
        </div>

        {status && (
          <small
            className={`settings-avatar-status ${
              statusKind === "error" ? "is-error" : ""
            }`}
          >
            {status}
          </small>
        )}
      </div>
    </div>
  );
}
