import { NextResponse } from 'next/server';

const SHEETS_WEBAPP_URL = process.env.GOOGLE_APPS_SCRIPT_WEBAPP_URL;

export async function GET() {
  if (!SHEETS_WEBAPP_URL) {
    return NextResponse.json({ logoUrl: '' });
  }
  try {
    const res = await fetch(`${SHEETS_WEBAPP_URL}?action=logo`);
    const data = await res.json();
    return NextResponse.json({ logoUrl: data.logoUrl || '' });
  } catch (e) {
    return NextResponse.json({ logoUrl: '' });
  }
}
