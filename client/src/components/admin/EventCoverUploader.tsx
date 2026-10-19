import { ImagePlus, LoaderCircle, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Button, Input } from "@/components/admin/ui";
import { uploadEventCover } from "@/services/cloudinary-upload.service";

export interface EventCoverValue { url: string; publicId: string; alt: string }
interface Props { value: EventCoverValue; onChange: (value: EventCoverValue) => void; eventName: string }

const MAX_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function EventCoverUploader({ value, onChange, eventName }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  async function selectFile(file?: File) {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) { setError("Chỉ chấp nhận ảnh JPG, PNG hoặc WebP."); return; }
    if (file.size > MAX_SIZE) { setError("Ảnh bìa phải có dung lượng tối đa 8 MB."); return; }
    setError(""); setUploading(true); setProgress(0);
    try {
      const uploaded = await uploadEventCover(file, setProgress);
      onChange({ url: uploaded.url, publicId: uploaded.publicId, alt: value.alt || `Ảnh bìa ${eventName || "sự kiện"}` });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải ảnh lên.");
    } finally { setUploading(false); }
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setDragging(false); void selectFile(event.dataTransfer.files[0]);
  }

  return <div className="ev-coverup">
    <div className={`ev-coverup-drop ${dragging ? "is-dragging" : ""} ${value.url ? "has-image" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
      {value.url ? <img src={value.url} alt={value.alt || "Xem trước ảnh bìa sự kiện"} /> : <div className="ev-coverup-empty"><ImagePlus size={28} aria-hidden="true"/><strong>Ảnh bìa sự kiện</strong><span>Kéo ảnh vào đây hoặc chọn tệp · JPG, PNG, WebP · tối đa 8 MB · khuyến nghị 16:9</span></div>}
      {uploading && <div className="ev-coverup-progress" role="status"><LoaderCircle className="spin" size={22} aria-hidden="true"/><strong>Đang tải {progress}%</strong><span><i style={{ width: `${progress}%` }}/></span></div>}
    </div>
    {value.url && <p className="ev-coverup-note">Xem trước theo khung thẻ sự kiện trên trang khách (16:10); ảnh được cắt vừa khung, không bị kéo giãn.</p>}
    <div className="ev-coverup-actions">
      <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void selectFile(event.target.files?.[0]); event.currentTarget.value = ""; }}/>
      <Button size="sm" icon={value.url ? RefreshCw : UploadCloud} onClick={() => inputRef.current?.click()} disabled={uploading}>{value.url ? "Thay ảnh" : "Chọn ảnh"}</Button>
      {value.url && <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={() => onChange({ url: "", publicId: "", alt: "" })} disabled={uploading}>Xóa ảnh</Button>}
    </div>
    {value.url && <label className="adm-field"><span className="adm-field-label">Mô tả ảnh (cho trình đọc màn hình)</span><Input maxLength={255} value={value.alt} onChange={(event) => onChange({ ...value, alt: event.target.value })} placeholder={`Ảnh bìa ${eventName || "sự kiện"}`} /></label>}
    {error && <p className="adm-field-error" role="alert">{error}</p>}
  </div>;
}
