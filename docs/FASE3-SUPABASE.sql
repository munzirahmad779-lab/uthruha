-- Fase 3 Uthruha — tabel KV generik untuk store server (lib/server/store.ts).
-- Jalankan di Supabase SQL Editor pada proyek Uthruha, lalu isi env
-- SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY di Vercel.
-- Tanpa tabel ini, store memakai berkas JSON lokal (di Vercel = /tmp,
-- TIDAK persisten antar-instance — jadi tabel ini syarat produksi Fase 3).

create table if not exists public.uthruha_kv (
  koleksi text not null,
  id text not null,
  data jsonb not null,
  diperbarui timestamptz not null default now(),
  primary key (koleksi, id)
);

-- Hanya service role yang boleh mengakses (RLS aktif tanpa policy publik).
alter table public.uthruha_kv enable row level security;
