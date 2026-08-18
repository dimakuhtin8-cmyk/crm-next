import { z } from 'zod';

import { verifyTelegramAuth, createFirebaseTokenFromTelegram } from './telegram';

import type { FastifyReply, FastifyRequest } from 'fastify';

const telegramAuthSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.number(),
  hash: z.string(),
});

export async function telegramAuthHandler(req: FastifyRequest, reply: FastifyReply) {
  try {
    const body = telegramAuthSchema.parse(req.body);

    // Verify Telegram auth data
    const result = verifyTelegramAuth({
      success: true,
      user: body,
    });

    if (!result.success || !result.user) {
      return reply.status(401).send({
        success: false,
        error: result.error || 'Authentication failed',
      });
    }

    // Create Firebase custom token
    const firebaseToken = await createFirebaseTokenFromTelegram(result.user);

    return reply.send({
      success: true,
      token: firebaseToken,
      user: {
        id: result.user.id,
        firstName: result.user.first_name,
        lastName: result.user.last_name,
        username: result.user.username,
        photoUrl: result.user.photo_url,
      },
    });
  } catch (error) {
    req.log.error({ error }, 'Telegram auth error');
    return reply.status(400).send({
      success: false,
      error: 'Invalid request data',
    });
  }
}
