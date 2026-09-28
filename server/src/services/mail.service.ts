import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export interface MailTicket { ticketCode: string; ticketTypeName: string; qrDataUrl: string; eventName: string; startTime: Date; endTime: Date; venue: string }

function createTransporter() {
    if (!env.MAIL_USER || !env.MAIL_APP_PASSWORD) throw new Error('Máy chủ chưa cấu hình MAIL_USER và MAIL_APP_PASSWORD');
    return nodemailer.createTransport({ service: 'gmail', auth: { user: env.MAIL_USER, pass: env.MAIL_APP_PASSWORD } });
}

export function sendEmailVerificationCode(recipient: string, code: string) {
    return createTransporter().sendMail({
        from: `"${env.MAIL_FROM_NAME.replaceAll('"', '')}" <${env.MAIL_USER}>`, to: recipient,
        subject: 'Mã xác minh email - TicketBox QR',
        html: `<h2>Xác minh email nhận vé</h2><p>Mã xác minh của bạn là:</p><p style="font-size:30px;font-weight:bold;letter-spacing:6px">${code}</p><p>Mã có hiệu lực trong 5 phút. Không cung cấp mã này cho người khác.</p>`,
    });
}

export async function sendTicketEmail(input: { recipient: string; buyerName: string; orderCode: string; tickets: MailTicket[] }) {
    const transporter = createTransporter();
    const attachments = input.tickets.map((ticket, index) => ({
        filename: `${ticket.ticketCode}.png`, content: Buffer.from(ticket.qrDataUrl.split(',')[1] ?? '', 'base64'), cid: `ticket-${index}@ticketbox`,
    }));
    const ticketHtml = input.tickets.map((ticket, index) => `
      <div style="border:1px solid #ddd;border-radius:12px;padding:16px;margin:12px 0;text-align:center">
        <h3>${escapeHtml(ticket.eventName)}</h3>
        <p>Bắt đầu: ${escapeHtml(ticket.startTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }))}<br>
        Kết thúc: ${escapeHtml(ticket.endTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }))}<br>
        Địa điểm: ${escapeHtml(ticket.venue)}</p>
        <strong>${escapeHtml(ticket.ticketTypeName)}</strong><br><span>Mã vé: ${escapeHtml(ticket.ticketCode)}</span><br>
        <img src="cid:ticket-${index}@ticketbox" width="240" alt="QR vé ${escapeHtml(ticket.ticketCode)}">
      </div>`).join('');
    return transporter.sendMail({
        from: `"${env.MAIL_FROM_NAME.replaceAll('"', '')}" <${env.MAIL_USER}>`, to: input.recipient,
        subject: `Vé điện tử ${input.orderCode} - TicketBox QR`,
        html: `<h2>Đơn hàng đã được xác nhận</h2><p>Xin chào ${escapeHtml(input.buyerName)}, đây là ${input.tickets.length} vé trong đơn <b>${escapeHtml(input.orderCode)}</b>.</p><p><b>Lưu ý:</b> thanh toán trong TicketBox QR là mô phỏng phục vụ đồ án; không có giao dịch tiền thật qua ngân hàng hoặc cổng thanh toán.</p>${ticketHtml}<p>Vui lòng mang mã QR đến sự kiện và không chia sẻ mã với người khác.</p>`,
        attachments,
    });
}

export function sendEventCancellationEmail(input:{recipient:string;buyerName:string;orderCode:string;eventName:string;venue:string;startTime:Date;cancellationReason:string}){
    return createTransporter().sendMail({
        from:`"${env.MAIL_FROM_NAME.replaceAll('"','')}" <${env.MAIL_USER}>`,to:input.recipient,
        subject:`Sự kiện đã hủy: ${input.eventName} - TicketBox QR`,
        html:`<h2>Thông báo hủy sự kiện</h2><p>Xin chào ${escapeHtml(input.buyerName)},</p><p>Sự kiện <b>${escapeHtml(input.eventName)}</b> tại ${escapeHtml(input.venue)}, dự kiến bắt đầu lúc ${escapeHtml(input.startTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }))}, đã bị hủy.</p><p><b>Lý do:</b> ${escapeHtml(input.cancellationReason)}</p><p>Đơn hàng của bạn là <b>${escapeHtml(input.orderCode)}</b>. Tất cả mã QR đã được vô hiệu hóa. Nếu đơn đã thanh toán, hệ thống đã ghi nhận yêu cầu hoàn tiền <b>mô phỏng</b> phục vụ đồ án; đây không phải xác nhận tiền thật đã được chuyển về tài khoản.</p>`,
    });
}

function escapeHtml(value: string) {
    return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char);
}
