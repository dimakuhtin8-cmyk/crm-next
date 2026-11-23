import { withAuth } from '@/lib/auth-guard';
import { handleImportRequest } from '@/lib/import/http';

import type { NextRequest } from 'next/server';

/**
 * POST /api/tasks/import — import/actualize tasks from
 * Excel/CSV/Google Sheets rows (thin wrapper over /api/import for tasks).
 *
 * Body: { mode?: 'create'|'upsert', mapping?, rows } → { report }
 */
async function POSTHandler(request: NextRequest) {
  return handleImportRequest(request, { entity: 'task' });
}

export const POST = withAuth({ permission: 'task:create' })(POSTHandler);
