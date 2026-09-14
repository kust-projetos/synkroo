/**
 * Meta (WhatsApp Business) message payload schemas (D3).
 *
 * Estrutura com Zod o parser manual `parseMetaMessage` da rota
 * `src/app/api/whatsapp/webhook/route.ts`, preservando o comportamento:
 * payload inválido → null (a rota responde 400), objeto não-WhatsApp ou
 * sem mensagens → ignore em 200. Apenas estruturação, sem mudança de regra.
 */
import { z } from 'zod';

export type MetaMessageType = 'text' | 'image' | 'audio' | 'document';

const metaTextMessageSchema = z.object({
  type: z.literal('text'),
  text: z.object({
    body: z.string().min(1),
  }),
});

const metaMediaMessageSchema = z.object({
  caption: z.string().optional(),
});

const metaImageMessageSchema = z.object({
  type: z.literal('image'),
  image: metaMediaMessageSchema,
});

const metaAudioMessageSchema = z.object({
  type: z.literal('audio'),
  audio: z.unknown(),
});

const metaDocumentMessageSchema = z.object({
  type: z.literal('document'),
  document: metaMediaMessageSchema,
});

export function parseMetaMessage(message: unknown): {
  content: string;
  messageType: MetaMessageType;
} | null {
  const text = metaTextMessageSchema.safeParse(message);
  if (text.success) {
    return { content: text.data.text.body, messageType: 'text' };
  }
  const image = metaImageMessageSchema.safeParse(message);
  if (image.success) {
    const caption = image.data.image.caption;
    return { content: caption ? caption : '[Image]', messageType: 'image' };
  }
  const audio = metaAudioMessageSchema.safeParse(message);
  if (audio.success) {
    return { content: '[Audio]', messageType: 'audio' };
  }
  const document = metaDocumentMessageSchema.safeParse(message);
  if (document.success) {
    const caption = document.data.document.caption;
    return { content: caption ? caption : '[Document]', messageType: 'document' };
  }
  return null;
}
