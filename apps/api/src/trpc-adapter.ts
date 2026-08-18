import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import type { AnyRouter } from '@trpc/server';
import type { FastifyRequest, FastifyReply } from 'fastify';

interface ContextCreator {
  (opts: { req: FastifyRequest; reply: FastifyReply }): Promise<unknown> | unknown;
}

export function createFastifyHandler(router: AnyRouter, createContext: ContextCreator) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    const request = new Request(url.toString(), {
      method: req.method,
      headers: new Headers(req.headers as Record<string, string>),
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const response = await fetchRequestHandler({
      endpoint: '/trpc',
      req: request,
      router,
      createContext: () => createContext({ req, reply }),
    });

    const body = await response.text();

    reply.status(response.status);
    response.headers.forEach((value, key) => {
      reply.header(key, value);
    });
    reply.send(body);
  };
}
