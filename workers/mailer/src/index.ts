/**
 * Internal notification mailer. Reachable ONLY through a service binding from
 * the Pages worker (no route, workers_dev disabled) — so no auth beyond that.
 *
 * Sends from noreply@stampbench.com (zone has Email Routing enabled) to
 * Harvey's verified destination address.
 */
import { EmailMessage } from 'cloudflare:email';

interface Env {
  EMAIL: { send(message: EmailMessage): Promise<void> };
}

const FROM = 'noreply@stampbench.com';
const TO = 'harveypro3@gmail.com';

function mime(subject: string, text: string): string {
  const id = `<${crypto.randomUUID()}@stampbench.com>`;
  return (
    `From: Stampbench <${FROM}>\r\n` +
    `To: <${TO}>\r\n` +
    `Subject: ${subject.replace(/[\r\n]/g, ' ')}\r\n` +
    `Message-ID: ${id}\r\n` +
    `Date: ${new Date().toUTCString()}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: text/plain; charset=utf-8\r\n` +
    `\r\n` +
    text
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return new Response('POST only', { status: 405 });
    const { subject, text } = (await request.json()) as { subject?: string; text?: string };
    if (!subject || !text) return new Response('subject and text required', { status: 400 });
    await env.EMAIL.send(new EmailMessage(FROM, TO, mime(subject, text)));
    return Response.json({ ok: true });
  },
};
