export type NotificationKind = "expense" | "project" | "activity" | "other";
export type NotificationFilter = "all" | "expense" | "project" | "activity";

export type NotificationItem = {
  id: string;
  title: string;
  message: string | null;
  sourceUrl?: string | null;
  representativeExternalId: string | null;
  representativeName: string | null;
  kind: NotificationKind;
  occurredAt: string | null;
  createdAt: string;
  readAt: string | null;
  metadata?: Record<string, unknown> | null;
};

export type NotificationKindSummary = {
  kind: Exclude<NotificationKind, "other">;
  count: number;
  label: string;
  preview: string;
  href: string;
  latestAt: string;
};

export type NotificationGroup = {
  id: string;
  representativeExternalId: string | null;
  representativeName: string | null;
  headline: string;
  latestAt: string;
  unreadCount: number;
  total: number;
  href: string;
  breakdownText: string;
  kindSummaries: NotificationKindSummary[];
  items: NotificationItem[];
};

const KIND_ORDER: Array<Exclude<NotificationKind, "other">> = [
  "expense",
  "project",
  "activity",
];

function toTimestamp(value: string | null | undefined) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
}

export function inferNotificationKind(args: {
  kind?: string | null;
  title?: string | null;
  message?: string | null;
}): NotificationKind {
  const direct = String(args.kind ?? "")
    .trim()
    .toLowerCase();

  if (direct === "expense" || direct === "project" || direct === "activity") {
    return direct;
  }

  const text = `${args.title ?? ""} ${args.message ?? ""}`.toLowerCase();

  if (/(despesa|ceap|combust[ií]vel|passagem|telefonia|manuten)/.test(text)) {
    return "expense";
  }

  if (/(projeto|proposi[cç][aã]o|pec\b|pl\b|plp\b|requerimento)/.test(text)) {
    return "project";
  }

  if (
    /(atividade|vota[cç][aã]o|presen[cç]a|discurso|sess[aã]o|reuni[aã]o)/.test(
      text,
    )
  ) {
    return "activity";
  }

  return "other";
}

export function normalizeNotificationRow(row: {
  id: string;
  title: string;
  message: string | null;
  source_url?: string | null;
  sourceUrl?: string | null;
  representative_external_id?: string | number | null;
  representativeExternalId?: string | number | null;
  representative_name?: string | null;
  representativeName?: string | null;
  kind?: string | null;
  occurred_at?: string | null;
  occurredAt?: string | null;
  created_at?: string;
  createdAt?: string;
  read_at?: string | null;
  readAt?: string | null;
  metadata?: Record<string, unknown> | null;
}): NotificationItem {
  return {
    id: String(row.id),
    title: String(row.title ?? "Nova atualização"),
    message: typeof row.message === "string" ? row.message : null,
    sourceUrl:
      typeof row.sourceUrl === "string"
        ? row.sourceUrl
        : typeof row.source_url === "string"
          ? row.source_url
          : null,
    representativeExternalId:
      row.representativeExternalId !== undefined &&
      row.representativeExternalId !== null
        ? String(row.representativeExternalId)
        : row.representative_external_id !== undefined &&
            row.representative_external_id !== null
          ? String(row.representative_external_id)
          : null,
    representativeName:
      typeof row.representativeName === "string"
        ? row.representativeName
        : typeof row.representative_name === "string"
          ? row.representative_name
          : null,
    kind: inferNotificationKind({
      kind: row.kind,
      title: row.title,
      message: row.message,
    }),
    occurredAt:
      typeof row.occurredAt === "string"
        ? row.occurredAt
        : typeof row.occurred_at === "string"
          ? row.occurred_at
          : null,
    createdAt: String(
      row.createdAt ?? row.created_at ?? new Date().toISOString(),
    ),
    readAt:
      typeof row.readAt === "string"
        ? row.readAt
        : typeof row.read_at === "string"
          ? row.read_at
          : null,
    metadata: row.metadata ?? null,
  };
}

function pluralize(kind: Exclude<NotificationKind, "other">, count: number) {
  if (kind === "expense")
    return count === 1 ? "1 despesa" : `${count} despesas`;
  if (kind === "project")
    return count === 1 ? "1 projeto" : `${count} projetos`;
  return count === 1 ? "1 atividade" : `${count} atividades`;
}

function fallbackRepresentativeName(item: NotificationItem) {
  return item.representativeName?.trim() || "Atualização";
}

function shorten(text: string, max = 38) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length <= max
    ? trimmed
    : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function buildNotificationHref(
  item: Pick<NotificationItem, "representativeExternalId" | "kind">,
) {
  if (!item.representativeExternalId) return "/dashboard";

  if (item.kind === "expense") {
    return `/mandate/${item.representativeExternalId}?tab=expenses`;
  }

  if (item.kind === "project") {
    return `/mandate/${item.representativeExternalId}?tab=projects`;
  }

  if (item.kind === "activity") {
    return `/mandate/${item.representativeExternalId}?tab=activities`;
  }

  return `/mandate/${item.representativeExternalId}`;
}

export function groupNotifications(
  items: NotificationItem[],
  filter: NotificationFilter = "all",
): NotificationGroup[] {
  const filtered = items.filter((item) =>
    filter === "all" ? true : item.kind === filter,
  );
  const groups = new Map<string, NotificationItem[]>();

  for (const item of filtered) {
    const key = item.representativeExternalId || `single:${item.id}`;
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  }

  const result: NotificationGroup[] = [];

  for (const [key, groupItems] of groups.entries()) {
    const ordered = [...groupItems].sort(
      (a, b) =>
        toTimestamp(b.occurredAt || b.createdAt) -
        toTimestamp(a.occurredAt || a.createdAt),
    );

    const latestItem = ordered[0];
    const kindSummaries = KIND_ORDER.map((kind) => {
      const currentItems = ordered.filter((item) => item.kind === kind);
      if (!currentItems.length) return null;
      const latest = currentItems[0];
      const previewSource = latest.message || latest.title;

      return {
        kind,
        count: currentItems.length,
        label: pluralize(kind, currentItems.length),
        preview: shorten(previewSource),
        href: buildNotificationHref(latest),
        latestAt: latest.occurredAt || latest.createdAt,
      } as NotificationKindSummary;
    }).filter(Boolean) as NotificationKindSummary[];

    const total = ordered.length;
    const latestAt = latestItem.occurredAt || latestItem.createdAt;
    const headline =
      filter === "all"
        ? total === 1
          ? "1 nova atualização"
          : `${total} novas atualizações`
        : pluralize(filter, total);

    result.push({
      id: key,
      representativeExternalId: latestItem.representativeExternalId,
      representativeName: fallbackRepresentativeName(latestItem),
      headline,
      latestAt,
      unreadCount: ordered.filter((item) => !item.readAt).length,
      total,
      href: latestItem.representativeExternalId
        ? `/mandate/${latestItem.representativeExternalId}`
        : buildNotificationHref(latestItem),
      breakdownText: kindSummaries.map((summary) => summary.label).join(" · "),
      kindSummaries,
      items: ordered,
    });
  }

  return result.sort(
    (a, b) => toTimestamp(b.latestAt) - toTimestamp(a.latestAt),
  );
}
