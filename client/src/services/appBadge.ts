/**
 * CollabSpace App Badging & Notification Service
 * Manages:
 * 1. Native OS Taskbar / Dock / PWA App Badges (navigator.setAppBadge)
 * 2. Dynamic High-Contrast Tab Favicon Badging (HTML5 Canvas)
 * 3. Browser Tab Title Unseen Message Counter
 * 4. Desktop Web Notifications (when tab is in background)
 */

interface UnreadNotificationDetails {
  senderName?: string;
  content?: string;
  groupName?: string;
}

class AppBadgeService {
  private unreadCount = 0;
  private originalTitle = 'CollabSpace — Work together. Communicate better.';
  private faviconEl: HTMLLinkElement | null = null;
  private baseIconImg: HTMLImageElement | null = null;
  private isIconLoaded = false;
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    this.originalTitle = document.title || this.originalTitle;
    this.faviconEl = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

    // Preload SVG base icon for canvas composition
    this.baseIconImg = new Image();
    this.baseIconImg.crossOrigin = 'anonymous';
    this.baseIconImg.src = '/icon.svg';
    this.baseIconImg.onload = () => {
      this.isIconLoaded = true;
    };

    // Auto-clear notifications when the user focuses on or returns to the tab
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.clearBadge();
      }
    });

    window.addEventListener('focus', () => {
      this.clearBadge();
    });
  }

  /**
   * Request browser desktop notification permission smoothly
   */
  public async requestNotificationPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Increments unseen message count and notifies user via:
   * - App badge (OS Taskbar / Dock)
   * - Tab favicon badge (Canvas overlay)
   * - Tab title indicator
   * - Desktop notification (if backgrounded)
   */
  public incrementUnread(details?: UnreadNotificationDetails) {
    this.unreadCount += 1;
    this.renderBadge();

    // 1. Native App Badging API for installed PWA / Chrome / Edge
    if ('setAppBadge' in navigator) {
      (navigator as any).setAppBadge(this.unreadCount).catch(() => {});
    }

    // 2. Desktop Push / Web Notification
    if (
      document.hidden &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      try {
        const title = details?.senderName
          ? `${details.senderName} (${details.groupName || 'CollabSpace'})`
          : 'New CollabSpace Message';
        const body = details?.content || 'You have new unseen messages in your workspace';

        new Notification(title, {
          body,
          icon: '/icon.svg',
          tag: 'collabspace-unread-notification',
        });
      } catch {
        // Ignore notification errors in restricted browser environments
      }
    }
  }

  /**
   * Resets unseen counter and restores clean icon & title
   */
  public clearBadge() {
    if (this.unreadCount === 0) return;
    this.unreadCount = 0;

    // 1. Clear Native App Badge
    if ('clearAppBadge' in navigator) {
      (navigator as any).clearAppBadge().catch(() => {});
    }

    // 2. Restore Default Favicon
    if (!this.faviconEl) {
      this.faviconEl = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    }
    if (this.faviconEl) {
      this.faviconEl.href = '/icon.svg';
    }

    // 3. Restore Default Title
    document.title = this.originalTitle;
  }

  public getUnreadCount(): number {
    return this.unreadCount;
  }

  private renderBadge() {
    if (this.unreadCount <= 0) {
      this.clearBadge();
      return;
    }

    const badgeLabel = this.unreadCount > 99 ? '99+' : `${this.unreadCount}`;

    // 1. Update Document Title
    document.title = `(${badgeLabel}) 💬 ${this.originalTitle}`;

    // 2. Render Favicon Canvas Badge
    try {
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const drawRounded = (x: number, y: number, w: number, h: number, r: number) => {
        const anyCtx = ctx as any;
        if (typeof anyCtx.roundRect === 'function') {
          anyCtx.roundRect(x, y, w, h, r);
        } else {
          ctx.rect(x, y, w, h);
        }
      };

      // Draw base icon or stylized fallback background
      if (this.isIconLoaded && this.baseIconImg) {
        ctx.drawImage(this.baseIconImg, 0, 0, size, size);
      } else {
        // Stylized dark brand fallback
        ctx.fillStyle = '#0D1322';
        ctx.beginPath();
        drawRounded(0, 0, size, size, 16);
        ctx.fill();

        ctx.fillStyle = '#6366F1';
        ctx.beginPath();
        drawRounded(14, 14, 36, 36, 10);
        ctx.fill();
      }

      // Draw Notification Badge in top right corner
      const isMulti = badgeLabel.length > 1;
      const badgeWidth = isMulti ? 38 : 28;
      const badgeHeight = 28;
      const badgeX = size - badgeWidth - 1;
      const badgeY = 1;
      const radius = 14;

      // Red notification badge fill
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      drawRounded(badgeX, badgeY, badgeWidth, badgeHeight, radius);
      ctx.fill();

      // Sharp white outline border
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Bold centered badge number
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeLabel, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 1);

      // Apply dynamic data URL to icon link element
      if (!this.faviconEl) {
        this.faviconEl = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      }
      if (this.faviconEl) {
        this.faviconEl.href = canvas.toDataURL('image/png');
      }
    } catch (err) {
      console.warn('Canvas favicon badge note:', err);
    }
  }
}

export const appBadgeService = new AppBadgeService();
