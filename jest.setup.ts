/**
 * Jest setup file
 */

// Extend Jest matchers
import '@testing-library/jest-dom'

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.MINIMAX_API_KEY = 'test-minimax-key'
process.env.MINIMAX_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2'
process.env.MINIMAX_MODEL = 'abab6.5s-chat'
process.env.WHATSAPP_VERIFY_TOKEN = 'synkroo_webhook_token'
process.env.WHATSAPP_APP_SECRET = 'test-app-secret'
process.env.WHATSAPP_ACCESS_TOKEN = 'test-access-token'
process.env.INSTAGRAM_VERIFY_TOKEN = 'synkroo_instagram_token'
process.env.INSTAGRAM_ACCESS_TOKEN = 'test-instagram-token'

// Mock fetch globally
global.fetch = jest.fn()

// Suppress console logs in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}