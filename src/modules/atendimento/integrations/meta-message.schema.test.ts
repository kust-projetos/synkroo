/**
 * D3 — parseMetaMessage (Zod) paridade com o parser manual anterior.
 */
import { parseMetaMessage } from './meta-message.schema'

describe('parseMetaMessage', () => {
  it('text com body → content + text', () => {
    expect(parseMetaMessage({ type: 'text', text: { body: 'Olá' } }))
      .toEqual({ content: 'Olá', messageType: 'text' })
  })

  it('text com body vazio → null (rota responde 400)', () => {
    expect(parseMetaMessage({ type: 'text', text: { body: '' } })).toBeNull()
    expect(parseMetaMessage({ type: 'text' })).toBeNull()
  })

  it('image com/sem caption', () => {
    expect(parseMetaMessage({ type: 'image', image: { caption: 'nota' } }))
      .toEqual({ content: 'nota', messageType: 'image' })
    expect(parseMetaMessage({ type: 'image', image: {} }))
      .toEqual({ content: '[Image]', messageType: 'image' })
    expect(parseMetaMessage({ type: 'image', image: { caption: '' } }))
      .toEqual({ content: '[Image]', messageType: 'image' })
  })

  it('audio → [Audio]', () => {
    expect(parseMetaMessage({ type: 'audio', audio: { id: 'a1' } }))
      .toEqual({ content: '[Audio]', messageType: 'audio' })
    expect(parseMetaMessage({ type: 'audio' })).toBeNull()
  })

  it('document com/sem caption', () => {
    expect(parseMetaMessage({ type: 'document', document: { caption: 'd' } }))
      .toEqual({ content: 'd', messageType: 'document' })
    expect(parseMetaMessage({ type: 'document', document: {} }))
      .toEqual({ content: '[Document]', messageType: 'document' })
  })

  it('tipo desconhecido ou ausente → null', () => {
    expect(parseMetaMessage({ type: 'sticker', sticker: { id: 's' } })).toBeNull()
    expect(parseMetaMessage({})).toBeNull()
    expect(parseMetaMessage(null)).toBeNull()
  })
})
