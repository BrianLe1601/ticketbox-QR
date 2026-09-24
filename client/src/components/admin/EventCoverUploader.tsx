import { ImagePlus, LoaderCircle, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
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

  return <div className="event-cover-field">
    <div className={`event-cover-dropzone ${dragging ? "dragging" : ""} ${value.url ? "has-image" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
      {value.url ? <img src={value.url} alt={value.alt || "Xem trước ảnh bìa sự kiện"} /> : <div className="event-cover-empty"><ImagePlus size={30}/><strong>Tải ảnh bìa sự kiện</strong><span>Kéo ảnh vào đây hoặc chọn tệp</span><small>JPG, PNG, WebP · tối đa 8 MB · khuyến nghị 16:9</small></div>}
      {uploading && <div className="event-cover-progress"><LoaderCircle className="spin" size={24}/><strong>Đang tải {progress}%</strong><span><i style={{ width: `${progress}%` }}/></span></div>}
    </div>
    <div className="event-cover-actions">
      <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void selectFile(event.target.files?.[0]); event.currentTarget.value = ""; }}/>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>{value.url ? <RefreshCw size={15}/> : <UploadCloud size={15}/>} {value.url ? "Thay ảnh" : "Chọn ảnh"}</button>
      {value.url && <button type="button" className="danger" onClick={() => onChange({ url: "", publicId: "", alt: "" })} disabled={uploading}><Trash2 size={15}/> Xóa ảnh</button>}
    </div>
    {value.url && <label>Mô tả ảnh (hỗ trợ khả năng truy cập)<input maxLength={255} value={value.alt} onChange={(event) => onChange({ ...value, alt: event.target.value })} placeholder={`Ảnh bìa ${eventName || "sự kiện"}`} /></label>}
    {error && <p className="event-cover-error">{error}</p>}
  </div>;
}
