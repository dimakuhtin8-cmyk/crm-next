/**
 * GET /api/billing/plans — List all available plans with limits
 */

import { NextResponse } from 'next/server';
import { getAllPlans } from '@/lib/billing/plans';

export async function GET() {
  const plans = getAllPlans();
  return NextResponse.json({ plans });
}
