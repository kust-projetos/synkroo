/**
 * Channel Service — atendimento module (P2 port).
 *
 * Ported from legacy @/services/whatsapp/whatsapp.service.ts and
 * @/services/whatsapp/index.ts (sendWhatsAppMessage facade).
 *
 * Provides:
 *  - WhatsAppService (Playwright browser automation)
 *  - sendWhatsAppMessage (provider-dispatching facade)
 *  - sendByChannel (channel abstraction for actions)
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import QRCode from 'qrcode-terminal';
import { EventEmitter } from 'events';
import { dbLogger } from '@/lib/logger';
import { getEvolutionService } from './evolution-service';

// ─── Types ─────────────────────────────────────────────────────

export type WhatsAppProvider = 'evolution' | 'playwright' | 'business-api';

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: Date;
  type: 'text' | 'image' | 'audio' | 'document';
  isFromMe: boolean;
}

export interface WhatsAppSession {
  isConnected: boolean;
  phoneNumber: string | null;
  lastActivity: Date | null;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ─── Provider detection ────────────────────────────────────────

function detectProvider(): WhatsAppProvider {
  if (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY) return 'evolution';
  if (process.env.WHATSAPP_API_URL && process.env.WHATSAPP_TOKEN) return 'business-api';
  return 'playwright';
}

// ─── Unified send facade ───────────────────────────────────────

/** Send a WhatsApp message using the configured provider. */
export async function sendWhatsAppMessage(
  phone: string, message: string,
): Promise<SendResult> {
  const provider = detectProvider();

  if (provider === 'evolution') {
    const evolutionService = getEvolutionService();
    if (evolutionService) {
      return evolutionService.sendTextMessage(phone, message);
    }
  }

  if (provider === 'playwright') {
    const service = getWhatsAppService();
    if (service?.isConnected) {
      return service.sendMessage(phone, message);
    }
  }

  return { success: false, error: 'No WhatsApp provider available' };
}

// ─── Channel abstraction ───────────────────────────────────────

/** Dispatch outbound message by channel. */
export async function sendByChannel(
  channel: 'whatsapp' | 'instagram' | 'web',
  to: string,
  text: string,
): Promise<SendResult> {
  switch (channel) {
    case 'whatsapp':
      return sendWhatsApp(to, text);
    case 'instagram':
      return sendInstagram(to, text);
    case 'web':
      return { success: false, error: 'Web widget is receive-only' };
  }
}

export async function sendWhatsApp(to: string, text: string): Promise<SendResult> {
  try {
    const evolution = getEvolutionService();
    if (!evolution) return { success: false, error: 'Evolution service not available' };
    const result = await evolution.sendTextMessage(to, text);
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    dbLogger.error('channel-service: evolution send failed', err);
    return { success: false, error: msg };
  }
}

export async function sendInstagram(_to: string, _text: string): Promise<SendResult> {
  dbLogger.warn('channel-service: instagram send not implemented');
  return { success: false, error: 'Instagram outbound not yet implemented' };
}

// ─── WhatsAppService (Playwright browser automation) ────────────

export class WhatsAppService extends EventEmitter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private _isConnected: boolean = false;
  private sessionPath: string;
  private messageQueue: WhatsAppMessage[] = [];
  private currentQRCode: string | null = null;
  private phoneNumber: string | null = null;

  constructor(sessionPath: string = './.whatsapp-session') {
    super();
    this.sessionPath = sessionPath;
  }

  get isConnected(): boolean { return this._isConnected; }

  async initialize(): Promise<void> {
    const headless = process.env.WHATSAPP_HEADLESS === 'true';
    this.context = await chromium.launchPersistentContext(this.sessionPath, {
      headless,
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox'],
    });
    this.page = await this.context.newPage();
    await this.page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle' });
    const isLoggedIn = await this.checkLoginStatus();
    if (!isLoggedIn) {
      await this.waitForQRCode();
    } else {
      this._isConnected = true;
      this.emit('connected');
      console.log('✅ WhatsApp already connected');
    }
    this.startMessageListener();
  }

  private async checkLoginStatus(): Promise<boolean> {
    if (!this.page) return false;
    try {
      const chatList = await this.page.$('[data-testid="chat-list"]');
      return chatList !== null;
    } catch { return false; }
  }

  private async waitForQRCode(): Promise<void> {
    if (!this.page) return;
    console.log('📱 Waiting for QR code scan...');
    await this.page.waitForSelector('canvas[alt="Scan this QR code to link a device!"]', { timeout: 30000 });
    const qrCanvas = await this.page.$('canvas[alt="Scan this QR code to link a device!"]');
    if (qrCanvas) {
      const qrDataUrl = await qrCanvas.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
      QRCode.generate(qrDataUrl, { small: true }, (qr: string) => {
        console.log('\n📱 Scan this QR code with your WhatsApp app:\n');
        console.log(qr);
      });
      this.currentQRCode = qrDataUrl;
      this.emit('qrcode', qrDataUrl);
    }
    try {
      await this.page.waitForSelector('[data-testid="chat-list"]', { timeout: 120000 });
      this._isConnected = true;
      this.currentQRCode = null;
      await this.extractPhoneNumber();
      this.emit('connected');
      console.log('✅ WhatsApp connected successfully!');
    } catch (error) {
      this.emit('error', new Error('QR code scan timeout'));
      throw new Error('Timeout waiting for QR code scan');
    }
  }

  private startMessageListener(): void {
    if (!this.page) return;
    setInterval(async () => {
      if (!this.page || !this._isConnected) return;
      try {
        const unreadChats = await this.page.$$('[data-testid="chat-list"] [aria-label*="unread"]');
        for (const chat of unreadChats) {
          await chat.click();
          await this.page.waitForTimeout(500);
          const messages = await this.page.$$eval(
            '[data-testid="msg-container"]',
            (elements) => elements.slice(-5).map((el) => ({
              id: el.getAttribute('data-id') || '',
              body: el.textContent || '',
              isFromMe: el.closest('[data-testid="msg-container"]')?.classList.contains('message-out') || false,
            })),
          );
          for (const msg of messages) {
            if (!msg.isFromMe) {
              this.emit('message', {
                id: msg.id, from: await this.getCurrentChatPhone(), to: 'me',
                body: msg.body, timestamp: new Date(), type: 'text', isFromMe: false,
              } as WhatsAppMessage);
            }
          }
        }
      } catch (error) { console.error('Error checking messages:', error); }
    }, 5000);
  }

  private async getCurrentChatPhone(): Promise<string> {
    if (!this.page) return '';
    try {
      const phoneElement = await this.page.$('[data-testid="header"] span[title]');
      const title = await phoneElement?.getAttribute('title');
      return title || '';
    } catch { return ''; }
  }

  async sendMessage(to: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    if (!this.page || !this._isConnected) return { success: false };
    try {
      const searchInput = await this.page.$('[data-testid="chat-list-search"]');
      if (!searchInput) throw new Error('Search input not found');
      await searchInput.fill(to);
      await this.page.waitForTimeout(1000);
      const contactResult = await this.page.$(`[title="${to}"]`);
      if (!contactResult) {
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(500);
      } else {
        await contactResult.click();
      }
      await this.page.waitForSelector('[data-testid="conversation-compose-box-input"]', { timeout: 5000 });
      const messageInput = await this.page.$('[data-testid="conversation-compose-box-input"]');
      if (!messageInput) throw new Error('Message input not found');
      await messageInput.fill(message);
      await this.page.waitForTimeout(300);
      await this.page.keyboard.press('Enter');
      return { success: true, messageId: Date.now().toString() };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false };
    }
  }

  private async extractPhoneNumber(): Promise<void> {
    if (!this.page) return;
    try {
      const profileButton = await this.page.$('[data-testid="menu-bar"] button[aria-label]');
      if (profileButton) {
        await profileButton.click();
        await this.page.waitForTimeout(500);
        const phoneElement = await this.page.$('span[title*="+"]');
        if (phoneElement) {
          const title = await phoneElement.getAttribute('title');
          if (title) this.phoneNumber = title.replace(/\s/g, '');
        }
        await this.page.keyboard.press('Escape');
      }
    } catch (error) { console.error('Error extracting phone number:', error); }
  }

  getSession(): WhatsAppSession {
    return { isConnected: this._isConnected, phoneNumber: this.phoneNumber, lastActivity: new Date() };
  }

  getQRCode(): string | null { return this.currentQRCode; }

  async disconnect(): Promise<void> {
    if (this.context) await this.context.close();
    this._isConnected = false;
    this.emit('disconnected');
  }
}

// ─── Singleton ──────────────────────────────────────────────────

let whatsappInstance: WhatsAppService | null = null;

export function getWhatsAppService(): WhatsAppService {
  if (!whatsappInstance) {
    whatsappInstance = new WhatsAppService(process.env.WHATSAPP_SESSION_PATH);
  }
  return whatsappInstance;
}
