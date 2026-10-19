import { Camera, CameraOff, CheckCircle2, LoaderCircle, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type CheckState = 'idle' | 'starting' | 'ok' | 'failed';

/**
 * "Kiểm tra thiết bị trước ca trực": opens the camera locally (nothing is uploaded or scanned) so Staff
 * can grant permission and see the picture before the crowd arrives; stops it on demand or on leave.
 */
export function CameraCheck() {
  const [state, setState] = useState<CheckState>('idle');
  const [message, setMessage] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  const stop = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };
  useEffect(() => stop, []);

  async function start() {
    setState('starting');
    setMessage('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Trình duyệt chỉ mở camera trên HTTPS hoặc localhost.');
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (video.current) {
        video.current.srcObject = stream.current;
        await video.current.play().catch(() => {});
      }
      const label = stream.current.getVideoTracks()[0]?.label;
      setState('ok');
      setMessage(label ? `Camera hoạt động: ${label}.` : 'Camera hoạt động.');
    } catch (cause) {
      stop();
      setState('failed');
      setMessage(cause instanceof DOMException
        ? 'Không mở được camera. Hãy cho phép quyền camera trong trình duyệt hoặc kiểm tra thiết bị; vẫn có thể nhập mã vé tay.'
        : cause instanceof Error ? cause.message : 'Không mở được camera.');
    }
  }

  function end() {
    stop();
    setState('idle');
    setMessage('');
  }

  return (
    <div className="sp-camcheck">
      <div className={`sp-camcheck-view${state === 'ok' ? ' is-live' : ''}`}>
        <video ref={video} muted playsInline aria-label="Xem thử camera" />
        {state !== 'ok' && <Camera size={32} aria-hidden="true" />}
      </div>
      <div className="sp-camcheck-side">
        <strong>Kiểm tra thiết bị trước ca trực</strong>
        <span>Mở thử camera để cấp quyền và xem hình trước giờ mở cổng. Không quét, không gửi hình ảnh đi đâu.</span>
        {message && (
          <p className={`sp-camcheck-msg ${state === 'ok' ? 'is-ok' : 'is-failed'}`} role={state === 'failed' ? 'alert' : 'status'}>
            {state === 'ok' ? <CheckCircle2 size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />}
            {message}
          </p>
        )}
        {state === 'ok' ? (
          <button type="button" className="sp-btn sp-btn--ghost" onClick={end}><CameraOff size={18} aria-hidden="true" />Tắt camera thử</button>
        ) : (
          <button type="button" className="sp-btn sp-btn--outline" onClick={() => void start()} disabled={state === 'starting'}>
            {state === 'starting' ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Camera size={18} aria-hidden="true" />}
            {state === 'starting' ? 'Đang mở camera…' : state === 'failed' ? 'Thử lại' : 'Kiểm tra camera'}
          </button>
        )}
      </div>
    </div>
  );
}
