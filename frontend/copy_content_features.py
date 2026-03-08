import re

def main():
    with open('src/pages/Content.tsx', 'r') as f:
        content_ts = f.read()

    with open('src/pages/BatchContent.tsx', 'r') as f:
        batch_ts = f.read()

    # 1. We need to copy the imports
    imports = """
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { courseModuleApi } from '@/lib/course-module-api';
import axios from 'axios';
import getBlobDuration from 'get-blob-duration';
import { ImageCropperModal } from '@/components/ImageCropperModal';
"""
    batch_ts = batch_ts.replace("export default function BatchContent() {", f"{imports}\nexport default function BatchContent() {{")

    # 2. Add properties missing to state
    states = """
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDesc, setVideoDesc] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoThumbnail, setVideoThumbnail] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [sessionNumber, setSessionNumber] = useState<number | ''>('');
  const [weekday, setWeekday] = useState<string>('');
  const [videoFormErrors, setVideoFormErrors] = useState<Record<string, string>>({});
  
  const [uploadProgress, setUploadProgress] = useState(-1);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const thumbnailInputRef = React.useRef<HTMLInputElement>(null);
  const editThumbnailInputRef = React.useRef<HTMLInputElement>(null);

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        setVideoFormErrors(prev => ({ ...prev, thumbnail: 'Thumbnail image must be less than 2MB.' }));
        if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
        if (editThumbnailInputRef.current) editThumbnailInputRef.current.value = '';
        return;
      } else {
        setVideoFormErrors(prev => {
          const newErrs = { ...prev };
          delete newErrs.thumbnail;
          return newErrs;
        });
      }
      const reader = new FileReader();
      reader.addEventListener('load', () => setCropperSrc(reader.result?.toString() || null));
      reader.readAsDataURL(file);
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
      if (editThumbnailInputRef.current) editThumbnailInputRef.current.value = '';
    }
  };

  const handleCroppedImage = (file: File, url: string) => {
    setVideoThumbnail(file);
    setImagePreview(url);
    setCropperSrc(null);
  };
"""
    # Insert safely after `const [isSavingSession...`
    batch_ts = batch_ts.replace("const [isSavingSession, setIsSavingSession] = useState(false);", f"const [isSavingSession, setIsSavingSession] = useState(false);\n{states}")

    # 3. Replace the handleOpenSessionModal logic to handle state initialization 
    new_open_modal = """
  const handleOpenSessionModal = (session?: any) => {
    if (session) {
      setEditingSession(session);
      setVideoTitle(session.title);
      setVideoDesc(session.description || '');
      setSessionNumber(session.session_number);
      setWeekday(session.weekday || '');
      setVideoFile(null);
      setVideoThumbnail(null);
      setImagePreview(session.thumbnail || null);
    } else {
      setEditingSession(null);
      setVideoTitle('');
      setVideoDesc('');
      setSessionNumber(1);
      setWeekday('');
      setVideoFile(null);
      setVideoThumbnail(null);
      setImagePreview(null);
    }
    setVideoFormErrors({});
    setIsSessionModalOpen(true);
  };
"""
    # We use regex to substitute the existing handler
    import re
    # Using re.sub with DOTALL
    batch_ts = re.sub(r'const handleOpenSessionModal = .*?setIsSessionModalOpen\(true\);\n  };', new_open_modal.strip(), batch_ts, flags=re.DOTALL)

    # 4. We rewrite handleSaveSession with the S3 multipart logic
    new_save_session = """
  const handleSaveSession = async () => {
    const errors: Record<string, string> = {};
    if (!videoTitle.trim()) errors.title = 'Title is required';
    if (!batchId || !activeTab) errors.week = 'Please select a week/batch';
    if (sessionNumber === '' || sessionNumber <= 0) errors.session_number = 'Session number must be a valid number greater than 0';
    if (!weekday || weekday === 'none') errors.weekday = 'Weekday is required';
    if (!editingSession && !videoFile) errors.video_file = 'You must select a video file to upload';

    setVideoFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSavingSession(true);
    setUploadProgress(0);

    try {
      let finalVideoKey = '';
      let actualDurationSeconds = 0;

      if (videoFile) {
        try {
          const durationS = await getBlobDuration(videoFile);
          actualDurationSeconds = Math.round(durationS);
        } catch (err) {
          console.warn('Failed to parse video duration', err);
        }

        const initRes = await courseModuleApi.initMultipartUpload(videoFile.name, videoFile.type, videoFile.size);
        if (!initRes.success) throw new Error(initRes.message);

        const { upload_id, key, part_urls, chunk_size } = initRes.data;
        const uploadedParts = [];

        for (let i = 0; i < part_urls.length; i++) {
          const start = i * chunk_size;
          const end = Math.min(start + chunk_size, videoFile.size);
          const chunk = videoFile.slice(start, end);

          const uploadRes = await axios.put(part_urls[i], chunk, {
            headers: { 'Content-Type': videoFile.type },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const chunkPct = progressEvent.loaded / progressEvent.total;
                const overallPct = Math.round(((i + chunkPct) / part_urls.length) * 100);
                setUploadProgress(overallPct);
              }
            }
          });

          let etag = uploadRes.headers['etag'] || uploadRes.headers['ETag'];
          if (!etag) throw new Error("Storage server didn't return an ETag for the part.");
          
          uploadedParts.push({ ETag: etag, PartNumber: i + 1 });
        }

        const completeRes = await courseModuleApi.completeMultipartUpload(key, upload_id, uploadedParts);
        if (!completeRes.success) throw new Error("Failed to finalize upload.");
        
        finalVideoKey = completeRes.data.video_key;
      }

      const formData = new FormData();
      formData.append('title', videoTitle);
      formData.append('description', videoDesc);
      formData.append('session_number', sessionNumber.toString());
      formData.append('weekday', weekday);
      if (actualDurationSeconds > 0) formData.append('duration_seconds', actualDurationSeconds.toString()); 
      if (finalVideoKey) formData.append('video_file', finalVideoKey);
      if (videoThumbnail) formData.append('thumbnail', videoThumbnail);
      else if (imagePreview === null) formData.append('remove_thumbnail', 'true');

      if (editingSession) {
        await batchContentApi.updateSession(parseInt(batchId as string), parseInt(activeTab), editingSession.id, formData);
      } else {
        await batchContentApi.createSession(parseInt(batchId as string), parseInt(activeTab), formData);
      }
      
      toast({ title: 'Success', description: editingSession ? 'Session updated' : 'Session created' });
      setIsSessionModalOpen(false);
      fetchContent(parseInt(activeTab));
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to save session', variant: 'destructive' });
    } finally {
      setIsSavingSession(false);
      setUploadProgress(-1);
    }
  };
"""
    batch_ts = re.sub(r'const handleSaveSession = .*?setIsSavingSession\(false\);\n    }\n  };', new_save_session.strip(), batch_ts, flags=re.DOTALL)

    # 5. Overwrite the Dialog modal portion with the advanced UX form
    # We will grab from `<Dialog open={isSessionModalOpen}` to `</DialogContent>\n      </Dialog>` and replace.
    advanced_dialog = """
      <Dialog open={isSessionModalOpen} onOpenChange={(v) => { if (!v) setIsSessionModalOpen(false) }}>
        <DialogContent className="sm:max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editingSession ? 'Edit Class Session' : 'Add Class Session'}</DialogTitle>
            <DialogDescription>
              {editingSession ? 'Update details, upload a new video, or change the thumbnail.' : 'Upload a new video session to this week. Videos are uploaded directly to Object Storage.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <Label htmlFor="session_number">Session Number</Label>
                <Input
                  id="session_number"
                  type="number"
                  value={sessionNumber}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value) : '';
                    setSessionNumber(val as any);
                    if (videoFormErrors.session_number) setVideoFormErrors((p) => ({ ...p, session_number: '' }));
                  }}
                  className={videoFormErrors.session_number ? "border-destructive mt-1" : "mt-1"}
                />
                {videoFormErrors.session_number && <p className="text-xs text-destructive mt-1 absolute -bottom-5 left-0">{videoFormErrors.session_number}</p>}
              </div>

              <div className="relative">
                  <Label htmlFor="weekday" className="text-sm font-medium">Class Day</Label>
                  <Select value={weekday} onValueChange={(val) => {
                      setWeekday(val);
                      if (videoFormErrors.weekday) setVideoFormErrors(p => ({ ...p, weekday: '' }));
                  }}>
                      <SelectTrigger className={`mt-1 ${videoFormErrors.weekday ? "border-destructive" : ""}`}>
                          <SelectValue placeholder="Select a day" />
                      </SelectTrigger>
                      <SelectContent>
                          {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                              <SelectItem key={day} value={day} className="capitalize">{day}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                  {videoFormErrors.weekday && <p className="text-xs text-destructive mt-1 absolute -bottom-5 left-0">{videoFormErrors.weekday}</p>}
              </div>
            </div>

            <div className="grid gap-2 relative">
              <Label htmlFor="title">Session Title</Label>
              <Input
                id="title"
                value={videoTitle}
                onChange={(e) => {
                  setVideoTitle(e.target.value);
                  if (videoFormErrors.title) setVideoFormErrors((p) => ({ ...p, title: '' }));
                }}
                className={videoFormErrors.title ? "border-destructive" : ""}
                placeholder="e.g. Introduction to Variables"
              />
              {videoFormErrors.title && <p className="text-xs text-destructive absolute -bottom-5 left-0">{videoFormErrors.title}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Session Description (Optional)</Label>
              <Textarea
                id="description"
                value={videoDesc}
                onChange={(e) => setVideoDesc(e.target.value)}
                placeholder="Add notes, context, or homework references..."
                className="resize-none"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="grid gap-2">
                <Label>Video File</Label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${videoFormErrors.video_file ? 'border-destructive/50 bg-destructive/5' : 'hover:bg-muted/50'} ${videoFile || (editingSession && editingSession.video_file) ? 'bg-primary/5 border-primary/20' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="video/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setVideoFile(e.target.files[0]);
                        if (videoFormErrors.video_file) setVideoFormErrors((p) => ({ ...p, video_file: '' }));
                      }
                    }}
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    {videoFile ? (
                      <>
                        <div className="p-2 bg-primary/10 rounded-full">
                          <CheckCircle className="h-6 w-6 text-primary" />
                        </div>
                        <div className="text-sm font-medium text-primary line-clamp-1 px-4">{videoFile.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                        </div>
                      </>
                    ) : editingSession && editingSession.video_file ? (
                      <>
                        <div className="p-2 bg-primary/10 rounded-full">
                          <CheckCircle className="h-6 w-6 text-primary" />
                        </div>
                        <div className="text-sm font-medium text-primary">Video Uploaded</div>
                        <div className="text-xs text-muted-foreground mt-1 px-2">Click to replace existing video file</div>
                      </>
                    ) : (
                      <>
                        <div className="p-2 bg-muted rounded-full">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="text-sm font-medium">Click to upload video</div>
                        <div className="text-xs text-muted-foreground">MP4, WebM (Max 5GB)</div>
                      </>
                    )}
                  </div>
                </div>
                {videoFormErrors.video_file && <p className="text-xs text-destructive">{videoFormErrors.video_file}</p>}
              </div>

              <div className="grid gap-2">
                <Label>Custom Thumbnail</Label>
                <div 
                  className={`border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors h-[126px] relative overflow-hidden group ${videoFormErrors.thumbnail ? 'border-destructive/50' : 'hover:bg-muted/50'}`}
                  onClick={() => thumbnailInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={thumbnailInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleThumbnailSelect}
                  />
                  
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Thumbnail preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2">
                        <Upload className="h-6 w-6" />
                        <span className="text-xs font-medium">Replace Thumbnail</span>
                      </div>
                      <Button 
                        type="button" 
                        variant="destructive" 
                        size="icon" 
                        className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImagePreview(null);
                          setVideoThumbnail(null);
                          if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-2 h-full">
                      <div className="p-2 bg-muted rounded-full">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="text-sm font-medium px-2">Click to add thumbnail</div>
                      <div className="text-xs text-muted-foreground">16:9 ratio recommended</div>
                    </div>
                  )}
                </div>
                {videoFormErrors.thumbnail && <p className="text-xs text-destructive">{videoFormErrors.thumbnail}</p>}
              </div>
            </div>

            {/* Upload Progress Bar */}
            {uploadProgress >= 0 && (
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    Uploading {uploadProgress === 100 ? 'and Processing...' : 'Video...'}
                  </span>
                  <span className="font-bold text-primary">{Math.min(uploadProgress, 100)}%</span>
                </div>
                <div className="h-2 bg-muted overflow-hidden rounded-full">
                  <div 
                    className="h-full bg-primary transition-all duration-300 ease-out" 
                    style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsSessionModalOpen(false)} disabled={isSavingSession}>
              Cancel
            </Button>
            <Button variant="gradient" onClick={handleSaveSession} disabled={isSavingSession}>
              {isSavingSession ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploadProgress >= 0 ? 'Uploading...' : 'Saving...'}
                </>
              ) : (
                editingSession ? 'Update Session' : 'Save Session'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImageCropperModal
        isOpen={!!cropperSrc}
        onClose={() => setCropperSrc(null)}
        imageSrc={cropperSrc || ''}
        onCropComplete={handleCroppedImage}
        aspectRatio={16 / 9}
      />
"""
    batch_ts = re.sub(r'<Dialog open={isSessionModalOpen}.*?</DialogContent>\s*</Dialog>', advanced_dialog.strip(), batch_ts, flags=re.DOTALL)

    # 6. Make sure DialogFooter is imported
    if "DialogFooter" not in batch_ts:
       batch_ts = batch_ts.replace("DialogTitle,", "DialogTitle,\n  DialogFooter,")


    with open('src/pages/BatchContent.tsx', 'w') as f:
        f.write(batch_ts)

main()
