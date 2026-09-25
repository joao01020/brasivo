export type LocalUser = {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

const USERS_KEY = "brasivo_local_users";
const SESSION_KEY = "brasivo_local_session";

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getUsers(): LocalUser[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export async function registerLocalUser(name: string, email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const users = getUsers();

  if (users.some((user) => user.email === normalizedEmail)) {
    throw new Error("Já existe uma conta com este e-mail.");
  }

  const user: LocalUser = {
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: await sha256(password),
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(USERS_KEY, JSON.stringify([...users, user]));
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ name: user.name, email: user.email }),
  );

  return { name: user.name, email: user.email };
}

export async function loginLocalUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await sha256(password);
  const user = getUsers().find(
    (candidate) =>
      candidate.email === normalizedEmail &&
      candidate.passwordHash === passwordHash,
  );

  if (!user) {
    throw new Error("E-mail ou senha inválidos.");
  }

  const session = { name: user.name, email: user.email };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}
