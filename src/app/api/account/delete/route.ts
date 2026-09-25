import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const CONFIRMATION_TEXT = "EXCLUIR MINHA CONTA";

export async function DELETE(request: Request) {
  const client = await createClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  const user = userData.user;

  if (userError || !user) {
    return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  }

  let body: { confirmation?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Confirmação inválida." }, { status: 400 });
  }

  if (body.confirmation !== CONFIRMATION_TEXT) {
    return NextResponse.json({ error: "O texto de confirmação não confere." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    console.error("[ACCOUNT DELETE] Credencial administrativa do servidor não configurada.");
    return NextResponse.json(
      { error: "A exclusão de conta ainda não está configurada no servidor." },
      { status: 503 },
    );
  }

  const admin = createAdminClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    console.error("[ACCOUNT DELETE] Falha ao excluir usuário:", deleteError.message);
    return NextResponse.json(
      { error: "Não foi possível excluir a conta. Tente novamente." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
