import { useEffect, useRef, useState } from 'react';

export function CameraScanner({ onDetected, onClose }: {
  onDetected: (code: string) => void; onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => stream?.getTracks().forEach((track) => track.stop());
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', escape);
    async function start() {
      try {
        const { default: decodeQr } = await import('jsqr');
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera cần kết nối HTTPS hoặc localhost. Bạn vẫn có thể nhập mã vé.');
        }
        if (disposed) return;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (disposed) { stop(); return; }
        const element = video.current;
        if (!element) { stop(); return; }
        element.srcObject = stream;
        await element.play();
        if (disposed) { stop(); return; }
        setReady(true);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Không đọc được hình ảnh camera. Hãy nhập mã vé.');
        async function detect() {
          if (disposed) return;
          try {
            if (element!.readyState < 2 || !element!.videoWidth) {
              timer = setTimeout(() => { void detect(); }, 250);
              return;
            }
            const scale = Math.min(1, 720 / Math.max(element!.videoWidth, element!.videoHeight));
            canvas.width = Math.max(1, Math.round(element!.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(element!.videoHeight * scale));
            context!.drawImage(element!, 0, 0, canvas.width, canvas.height);
            const frame = context!.getImageData(0, 0, canvas.width, canvas.height);
            const code = decodeQr(frame.data, frame.width, frame.height)?.data;
            if (code) { stop(); onDetected(code); return; }
            timer = setTimeout(() => { void detect(); }, 250);
          } catch {
            stop();
            if (!disposed) setError('Không đọc được camera. Hãy tắt camera và thử lại hoặc nhập mã vé.');
          }
        }
        void detect();
      } catch (cause) {
        stop();
        if (!disposed) setError(cause instanceof DOMException
          ? 'Không mở được camera. Kiểm tra quyền camera và thiết bị, hoặc nhập mã vé.'
          : cause instanceof Error ? cause.message : 'Không mở được camera.');
      }
    }
    void start();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      stop();
      window.removeEventListener('keydown', escape);
    };
  }, [onDetected, onClose]);

  return (
    <div className="camera-scanner-wrap">
      <div className="sp-cam-frame">
        <video
          ref={video}
          muted
          playsInline
          aria-label="Camera quét mã QR"
          className="camera-scanner-video"
        />
        {/* Viewfinder: corner brackets and a scan line (static when reduced motion is preferred). */}
        <span className="sp-cam-corners" aria-hidden="true"><i /><i /><i /><i /></span>
        {ready && !error && <span className="sp-cam-laser" aria-hidden="true" />}
      </div>
      {error ? (
        <p role="alert" className="camera-scanner-note camera-scanner-alert">
          {error}
        </p>
      ) : (
        <p role="status" className="camera-scanner-note">
          {ready ? 'Đưa mã QR của vé vào khung hình.' : 'Đang khởi động camera…'}
        </p>
      )}
      <button
        type="button"
        onClick={onClose}
        className="camera-scanner-close"
      >
        Tắt camera (Esc)
      </button>
    </div>
  );
}
