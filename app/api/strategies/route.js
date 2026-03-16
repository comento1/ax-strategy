import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'executive-strategies.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ departments: [], strategies: [] }, { status: 200 });
  }
}
