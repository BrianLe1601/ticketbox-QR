import QRCode from 'qrcode';

export function createTicketQrDataUrl(rawToken: string): Promise<string> {
    return QRCode.toDataURL(`ticketbox:${rawToken}`, {
        errorCorrectionLevel: 'H', width: 420, margin: 2,
        color: { dark: '#171229', light: '#FFFFFF' },
    });
}
