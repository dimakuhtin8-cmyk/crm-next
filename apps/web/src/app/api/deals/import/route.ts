import { withAuth } from '@/lib/auth-guard';
import { handleImportRequest } from '@/lib/import/http';

import type { NextRequest } from 'next/server';

/**
 * POST /api/deals/import — import/actualize deals from
 * Excel/CSV/Google Sheets rows (thin wrapper over /api/import for deals).
 *
 * Body: { mode?: 'create'|'upsert', mapping?, rows } → { report }
 */
async function POSTHandler(request: NextRequest) {
  return handleImportRequest(request, { entity: 'deal' });
}

export const POST = withAuth({ permission: 'deal:create' })(POSTHandler);
