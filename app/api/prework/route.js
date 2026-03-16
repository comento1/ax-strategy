import { NextResponse } from 'next/server';

const SHEETS_WEBAPP_URL = process.env.GOOGLE_APPS_SCRIPT_WEBAPP_URL;

async function proxyToSheets(method, req) {
  if (!SHEETS_WEBAPP_URL) {
    return NextResponse.json(
      { error: 'GOOGLE_APPS_SCRIPT_WEBAPP_URL이 설정되지 않았습니다.' },
      { status: 503 }
    );
  }

  try {
    if (method === 'GET') {
      const { searchParams } = new URL(req.url);
      const qs = searchParams.toString();
      const url = qs ? `${SHEETS_WEBAPP_URL}?${qs}` : `${SHEETS_WEBAPP_URL}`;
      const res = await fetch(url, { method: 'GET' });
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(data || { error: 'Sheets Web App 오류' }, { status: res.status >= 400 ? res.status : 500 });
      }
      if (Array.isArray(data)) return NextResponse.json(data);
      if (data && typeof data === 'object') return NextResponse.json(data);
      return NextResponse.json({});
    }

    if (method === 'POST') {
      const body = await req.json();
      const res = await fetch(SHEETS_WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(data || { error: 'Sheets Web App 오류' }, { status: res.status >= 400 ? res.status : 500 });
      }
      return NextResponse.json(data);
    }
  } catch (e) {
    return NextResponse.json({ error: String(e.message) }, { status: 500 });
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function GET(req) {
  return proxyToSheets('GET', req);
}

export async function POST(req) {
  return proxyToSheets('POST', req);
}
