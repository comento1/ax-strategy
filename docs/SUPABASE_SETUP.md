# Supabase 연동 설정

## 1. 테이블 생성

Supabase 대시보드 → **SQL Editor**에서 아래 SQL을 실행하세요.

```sql
-- 사전과제 제출 저장
create table if not exists public.prework_submissions (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  participant_name text not null default '익명',
  selected_strategy_id text,
  strategy_title text,
  workflow_steps jsonb not null default '[]',
  task_candidates jsonb not null default '[]',
  questions jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists idx_prework_department on public.prework_submissions (department);
create index if not exists idx_prework_created_at on public.prework_submissions (created_at desc);

alter table public.prework_submissions enable row level security;

create policy "Allow read for all"
  on public.prework_submissions for select using (true);

create policy "Allow insert for all"
  on public.prework_submissions for insert with check (true);
```

## 2. 환경 변수

Supabase 대시보드 → **Project Settings** → **API**에서 확인:

- **Project URL** → `SUPABASE_URL` (예: `https://latvqwryaszxxgfpxmjl.supabase.co`)
- **anon public** 키 → `SUPABASE_ANON_KEY`

로컬: `.env` 파일에 설정  
Vercel: **Settings** → **Environment Variables**에 추가

> API 라우트에서만 Supabase를 사용하므로 `NEXT_PUBLIC_` 없이 설정해도 됩니다. 키가 클라이언트에 노출되지 않습니다.

## 3. 동일 파일 (마이그레이션)

`supabase/migrations/001_prework_submissions.sql` 내용을 SQL Editor에 붙여 넣어 실행해도 됩니다.
