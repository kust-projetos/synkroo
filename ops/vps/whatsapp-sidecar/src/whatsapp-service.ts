import type { BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import { EventEmitter } from 'node:events';

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

export class WhatsAppService extends EventEmitter {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private _isConnected: boolean = false;
  private sessionPath: string;
  private currentQRCode: string | null = null;
  private phoneNumber: string | null = null;
  private lastActivity: Date | null = null;

  constructor(sessionPath: string = process.env.WHATSAPP_SESSION_PATH || './.whatsapp-session') {
    super();
    this.sessionPath = sessionPath;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  async initialize(): Promise<void> {
    const headless = process.env.WHATSAPP_HEADLESS !== 'false';
    this.context = await chromium.launchPersistentContext(this.sessionPath, {
      headless,
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox'],
    });

    this.page = this.context.pages()[0] ?? (await this.context.newPage());
    await this.page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(3_000);

    const isLoggedIn = await this.checkLoginStatus();
    if (!isLoggedIn) {
      await this.waitForQRCode();
    } else {
      this._isConnected = true;
      this.lastActivity = new Date();
      this.emit('connected');
    }
  }

  private async checkLoginStatus(): Promise<boolean> {
    if (!this.page) return false;
    try {
      await this.page.waitForSelector(
        '#pane-side, [data-testid="chat-list"], [data-testid="chat-list-search"], [aria-label="Search or start a new chat"], input[placeholder="Search or start a new chat"]',
        { timeout: 10_000 },
      );
      return true;
    } catch {
      return false;
    }
  }

  private async waitForQRCode(): Promise<void> {
    if (!this.page) return;
    await this.page.waitForSelector('canvas', { timeout: 30000 });
    const qrCanvas = await this.page.$('canvas');
    if (qrCanvas) {
      const qrDataUrl = await qrCanvas.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
      this.currentQRCode = qrDataUrl;
      this.emit('qrcode', qrDataUrl);
    }
    try {
      await this.page.waitForSelector('#pane-side, [data-testid="chat-list"]', { timeout: 120000 });
      this._isConnected = true;
      this.currentQRCode = null;
      this.lastActivity = new Date();
      await this.extractPhoneNumber();
      this.emit('connected');
    } catch (error) {
      this.emit('error', new Error('QR code scan timeout'));
      throw new Error('Timeout waiting for QR code scan');
    }
  }

  async sendMessage(to: string, message: string): Promise<SendResult> {
    if (!this.page || !this._isConnected) {
      return { success: false, error: 'WhatsApp session disconnected' };
    }
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
      this.lastActivity = new Date();
      return { success: true, messageId: Date.now().toString() };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
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
    } catch (error) {
      console.error('Error extracting phone number:', error);
    }
  }

  getSession(): WhatsAppSession {
    return {
      isConnected: this._isConnected,
      phoneNumber: this.phoneNumber,
      lastActivity: this.lastActivity,
    };
  }

  getQRCode(): string | null {
    return this.currentQRCode;
  }

  async disconnect(): Promise<void> {
    if (this.context) await this.context.close();
    this._isConnected = false;
    this.emit('disconnected');
  }
}

let instance: WhatsAppService | null = null;
export function getWhatsAppService(): WhatsAppService {
  if (!instance) {
    instance = new WhatsAppService();
  }
  return instance;
}
