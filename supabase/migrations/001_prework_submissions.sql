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

-- 본부별 조회용 인덱스
create index if not exists idx_prework_department on public.prework_submissions (department);
create index if not exists idx_prework_created_at on public.prework_submissions (created_at desc);

-- RLS: 익명 읽기/쓰기 허용 (워크숍용). 필요 시 나중에 인증으로 제한
alter table public.prework_submissions enable row level security;

create policy "Allow read for all"
  on public.prework_submissions for select
  using (true);

create policy "Allow insert for all"
  on public.prework_submissions for insert
  with check (true);
