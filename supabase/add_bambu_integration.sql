-- Add Bambu Lab integration token storage to profiles
-- Run once in the Supabase SQL editor

alter table public.profiles
  add column if not exists bambu_token text,
  add column if not exists bambu_email text;
