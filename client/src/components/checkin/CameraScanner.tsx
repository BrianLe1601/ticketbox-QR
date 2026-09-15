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

  return <div className="space-y-3 rounded-xl border border-cyan-400/25 p-4">
    <video ref={video} muted playsInline aria-label="Camera quét mã QR" className="aspect-video w-full rounded-lg bg-black object-cover" />
    {error ? <p role="alert" className="text-amber-300">{error}</p>
      : <p role="status">{ready ? 'Đưa một mã QR vào khung hình.' : 'Đang mở camera…'}</p>}
    <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-300">Tắt camera (Esc)</button>
  </div>;
}
