import { withAuth } from '@/lib/auth-guard';
import { handleImportRequest } from '@/lib/import/http';

import type { NextRequest } from 'next/server';

/**
 * POST /api/import — import/actualize contacts, deals or tasks from
 * Excel/CSV/Google Sheets rows.
 *
 * Body: { entity: 'contact'|'deal'|'task', mode?: 'create'|'upsert',
 *         mapping?, rows } → { report }
 */
async function POSTHandler(request: NextRequest) {
  return handleImportRequest(request);
}

export const POST = withAuth()(POSTHandler);
