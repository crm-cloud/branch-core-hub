import { useRef, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Link as LinkIcon, Upload, Video, X, AlertCircle } from 'lucide-react';
import {
  uploadVideo,
  validateVideoFile,
  isAcceptedVideoUrl,
  ACCEPTED_VIDEO_EXT,
  getVideoPublicUrl,
  deleteVideo,
} from '@/services/videoUploadService';

export interface VideoAttachmentValue {
  video_url?: string;
  video_file_path?: string;
}

interface Props {
  value: VideoAttachmentValue;
  onChange: (next: VideoAttachmentValue) => void;
  folder: 'exercises' | 'meals';
  label?: string;
}

/**
 * Tabbed URL / Upload control used by the workout exercise card and the meal
 * card. Persists `{ video_url, video_file_path }` into the parent draft.
 */
export function VideoAttachmentControl({ value, onChange, folder, label }: Props) {
  const [tab, setTab] = useState<'url' | 'upload'>(value.video_file_path ? 'upload' : 'url');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState(value.video_url || '');
  const fileRef = useRef<HTMLInputElement>(null);

  const hasAttachment = !!(value.video_url || value.video_file_path);
  const previewUrl = value.video_file_path ? getVideoPublicUrl(value.video_file_path) : value.video_url;

  const handleUrlBlur = () => {
    setError(null);
    const trimmed = urlInput.trim();
    if (!trimmed) {
      onChange({ ...value, video_url: undefined });
      return;
    }
    if (!isAcceptedVideoUrl(trimmed)) {
      setError('Use a YouTube, Vimeo, or direct .mp4/.mov/.webm URL.');
      return;
    }
    onChange({ video_file_path: undefined, video_url: trimmed });
  };

  const handleFile = async (file: File) => {
    setError(null);
    const v = validateVideoFile(file);
    if (v) {
      setError(v);
      return;
    }
    setUploading(true);
    try {
      const result = await uploadVideo(file, folder);
      onChange({ video_url: undefined, video_file_path: result.path });
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const clear = async () => {
    if (value.video_file_path) {
      try {
        await deleteVideo(value.video_file_path);
      } catch {
        /* swallow — UI clear must always succeed */
      }
    }
    setUrlInput('');
    setError(null);
    onChange({ video_url: undefined, video_file_path: undefined });
  };

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs">{label}</Label>}

      {hasAttachment ? (
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border">
          <Video className="h-4 w-4 text-accent flex-shrink-0" />
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs truncate text-primary hover:underline flex-1"
          >
            {value.video_file_path ? value.video_file_path.split('/').pop() : value.video_url}
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={clear}
            aria-label="Remove video"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'url' | 'upload')} className="w-full">
          <TabsList className="h-7 grid grid-cols-2 w-full">
            <TabsTrigger value="url" className="text-xs h-6">
              <LinkIcon className="h-3 w-3 mr-1" /> URL
            </TabsTrigger>
            <TabsTrigger value="upload" className="text-xs h-6">
              <Upload className="h-3 w-3 mr-1" /> Upload
            </TabsTrigger>
          </TabsList>
          <TabsContent value="url" className="mt-2">
            <Input
              placeholder="https://youtube.com/... or .mp4 link"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onBlur={handleUrlBlur}
              className="h-8 text-xs"
            />
          </TabsContent>
          <TabsContent value="upload" className="mt-2">
            <div className="flex items-center gap-2">
              <Input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_VIDEO_EXT}
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
                className="h-8 text-xs"
              />
              {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">MP4, MOV, WebM · max 50MB</p>
          </TabsContent>
        </Tabs>
      )}

      {error && (
        <p className="text-[11px] text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}
