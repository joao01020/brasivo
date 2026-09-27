import "dotenv/config";

import {
  createClient,
} from "@supabase/supabase-js";

const mandateId =
  process.argv[2];

const year =
  Number(
    process.argv[3] ??
      new Date()
        .getFullYear(),
  );

if (
  !mandateId ||
  !Number.isInteger(
    year,
  )
) {
  console.error(
    "Uso: npx tsx scripts/check-ceap-restitutions.ts <mandateId> [ano]",
  );
  process.exit(
    1,
  );
}

const url =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SECRET_KEY;

if (
  !url ||
  !key
) {
  throw new Error(
    "Variáveis privadas do Supabase não encontradas.",
  );
}

const supabase =
  createClient(
    url,
    key,
    {
      auth: {
        persistSession:
          false,
      },
    },
  );

const {
  data,
  error,
} =
  await supabase
    .from(
      "ceap_restitutions",
    )
    .select(
      "id,restitution_value,restitution_paid_at,official_document_id,category,supplier",
    )
    .eq(
      "representative_source",
      "camara",
    )
    .eq(
      "representative_external_id",
      String(
        mandateId,
      ),
    )
    .eq(
      "year",
      year,
    )
    .order(
      "restitution_paid_at",
      {
        ascending:
          false,
      },
    );

if (
  error
) {
  throw error;
}

const rows =
  data ??
  [];

const total =
  rows.reduce(
    (
      sum,
      row,
    ) =>
      sum +
      Number(
        row.restitution_value ??
          0,
      ),
    0,
  );

console.log(
  JSON.stringify(
    {
      mandateId,
      year,
      count:
        rows.length,
      total,
      recent:
        rows.slice(
          0,
          5,
        ),
    },
    null,
    2,
  ),
);
