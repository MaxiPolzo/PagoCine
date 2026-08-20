create extension if not exists "pgcrypto";

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  registration_code text not null unique,
  first_name text not null,
  last_name text not null,
  email text,
  whatsapp_phone text,
  full_name text not null,
  course text not null,
  amount integer,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'approved', 'rejected', 'duplicate', 'manual_review')),
  payment_date timestamptz,
  payment_operation_id text,
  payment_alias text,
  payment_cvu text,
  payment_holder text,
  receipt_storage_path text not null,
  receipt_original_filename text not null,
  receipt_hash text not null,
  ocr_text text,
  verification_notes text,
  verification_method text,
  checked_in boolean not null default false,
  checked_in_at timestamptz,
  checked_in_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);

create index if not exists registrations_status_idx on public.registrations(payment_status);
create index if not exists registrations_course_idx on public.registrations(course);
create index if not exists registrations_created_at_idx on public.registrations(created_at desc);
create index if not exists registrations_receipt_hash_idx on public.registrations(receipt_hash);
create index if not exists registrations_operation_id_idx
  on public.registrations(payment_operation_id)
  where payment_operation_id is not null;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_registrations_updated_at on public.registrations;
create trigger set_registrations_updated_at
before update on public.registrations
for each row execute function public.set_updated_at();

alter table public.registrations enable row level security;

drop policy if exists "Admins can read registrations" on public.registrations;
create policy "Admins can read registrations"
on public.registrations for select
to authenticated
using (true);

drop policy if exists "Admins can update registrations" on public.registrations;
create policy "Admins can update registrations"
on public.registrations for update
to authenticated
using (true)
with check (true);

drop policy if exists "Admins can insert registrations" on public.registrations;
create policy "Admins can insert registrations"
on public.registrations for insert
to authenticated
with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  8388608,
  array['application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = 8388608,
    allowed_mime_types = array['application/pdf'];

drop policy if exists "Admins can read receipt objects" on storage.objects;
create policy "Admins can read receipt objects"
on storage.objects for select
to authenticated
using (bucket_id = 'receipts');

drop policy if exists "Admins can upload receipt objects" on storage.objects;
create policy "Admins can upload receipt objects"
on storage.objects for insert
to authenticated
with check (bucket_id = 'receipts');
