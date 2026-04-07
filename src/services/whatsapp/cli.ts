/**
 * CLI for WhatsApp Service
 * Run with: npm run whatsapp:start
 */
/* eslint-disable no-console */

import { getWhatsAppService } from './whatsapp.service.js'

const whatsapp = getWhatsAppService()

// Handle events
whatsapp.on('qrcode', (qrDataUrl: string) => {
  console.log('\n📱 QR Code received (also available at /api/whatsapp/qrcode)')
})

whatsapp.on('connected', () => {
  console.log('✅ WhatsApp connected!')
})

whatsapp.on('message', (message) => {
  console.log('📨 New message:', message)
})

whatsapp.on('error', (error: Error) => {
  console.error('❌ WhatsApp error:', error.message)
})

whatsapp.on('disconnected', () => {
  console.log('📱 WhatsApp disconnected')
})

// Start service
console.log('🚀 Starting WhatsApp Web service...')
whatsapp.initialize().catch((error) => {
  console.error('Failed to initialize WhatsApp:', error)
  process.exit(1)
})

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...')
  await whatsapp.disconnect()
  process.exit(0)
})