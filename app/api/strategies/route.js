import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SHEETS_WEBAPP_URL = process.env.GOOGLE_APPS_SCRIPT_WEBAPP_URL;

export async function GET() {
  if (SHEETS_WEBAPP_URL) {
    try {
      const res = await fetch(`${SHEETS_WEBAPP_URL}?action=strategies`);
      const data = await res.json();
      if (data.departments && data.strategies) return NextResponse.json(data);
    } catch (e) {}
  }
  try {
    const filePath = path.join(process.cwd(), 'data', 'executive-strategies.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ departments: [], strategies: [] }, { status: 200 });
  }
}
