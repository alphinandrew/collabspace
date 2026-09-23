import QRCode from 'qrcode';

export const qrService = {
  renderToCanvas: async (canvas: HTMLCanvasElement, text: string): Promise<void> => {
    return QRCode.toCanvas(canvas, text, {
      width: 256,
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    });
  },

  generateDataUrl: async (text: string): Promise<string> => {
    return QRCode.toDataURL(text, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    });
  },

  parseInvitationPayload: (payloadStr: string): { token?: string; code?: string } | null => {
    try {
      const parsed = JSON.parse(payloadStr);
      if (parsed && parsed.platform === 'CollabSpace') {
        return { token: parsed.token, code: parsed.code };
      }
      return null;
    } catch (e) {
      // If plain token or code
      if (payloadStr.startsWith('CLB-')) {
        return { code: payloadStr };
      }
      if (payloadStr.length >= 24) {
        return { token: payloadStr };
      }
      return null;
    }
  },
};
