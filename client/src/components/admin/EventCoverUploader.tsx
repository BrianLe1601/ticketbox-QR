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
    if (!ALLOWED_TYPES.includes(file.type)) { setError("Use a JPG, PNG, or WebP image."); return; }
    if (file.size > MAX_SIZE) { setError("The cover image must be 8 MB or smaller."); return; }
    setError(""); setUploading(true); setProgress(0);
    try {
      const uploaded = await uploadEventCover(file, setProgress);
      onChange({ url: uploaded.url, publicId: uploaded.publicId, alt: value.alt || `${eventName || "Event"} cover` });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to upload the image.");
    } finally { setUploading(false); }
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setDragging(false); void selectFile(event.dataTransfer.files[0]);
  }

  return <div className="event-cover-field">
    <div className={`event-cover-dropzone ${dragging ? "dragging" : ""} ${value.url ? "has-image" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
      {value.url ? <img src={value.url} alt={value.alt || "Event cover preview"} /> : <div className="event-cover-empty"><ImagePlus size={30}/><strong>Upload event cover</strong><span>Drag an image here or choose a file</span><small>JPG, PNG, WebP · max 8 MB · recommended 16:9</small></div>}
      {uploading && <div className="event-cover-progress"><LoaderCircle className="spin" size={24}/><strong>Uploading {progress}%</strong><span><i style={{ width: `${progress}%` }}/></span></div>}
    </div>
    <div className="event-cover-actions">
      <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void selectFile(event.target.files?.[0]); event.currentTarget.value = ""; }}/>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>{value.url ? <RefreshCw size={15}/> : <UploadCloud size={15}/>} {value.url ? "Replace image" : "Choose image"}</button>
      {value.url && <button type="button" className="danger" onClick={() => onChange({ url: "", publicId: "", alt: "" })} disabled={uploading}><Trash2 size={15}/> Remove</button>}
    </div>
    {value.url && <label>Image description (accessibility)<input maxLength={255} value={value.alt} onChange={(event) => onChange({ ...value, alt: event.target.value })} placeholder={`${eventName || "Event"} cover`} /></label>}
    {error && <p className="event-cover-error">{error}</p>}
  </div>;
}
