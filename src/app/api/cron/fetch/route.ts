import { NextResponse } from 'next/server';
import { fetchDailyDCL } from '@/lib/dcl-service';

// To protect this route from arbitrary calls, we can demand a secret query param
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  // Basic security for cron (in production use env vars)
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await fetchDailyDCL();
    return NextResponse.json({ success: true, summary });
  } catch (error: any) {
    console.error("Cron fetch error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
