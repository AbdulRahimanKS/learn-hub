import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { getCroppedImg } from '@/lib/cropImage';
import { Crop, ZoomIn } from 'lucide-react';

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedFile: File, objectUrl: string) => void;
}

export function ImageCropperModal({
  isOpen,
  onClose,
  imageSrc,
  onCropComplete,
}: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const processCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    try {
      setIsProcessing(true);
      const croppedImageFile = await getCroppedImg(imageSrc, croppedAreaPixels);
      
      if (croppedImageFile) {
        const objectUrl = URL.createObjectURL(croppedImageFile);
        onCropComplete(croppedImageFile, objectUrl);
        onClose();
        // Reset crop state for next time
        setZoom(1);
        setCrop({ x: 0, y: 0 });
      }
    } catch (e) {
      console.error('Error cropping image:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Profile Photo</DialogTitle>
        </DialogHeader>
        
        <div className="relative w-full h-[300px] bg-black/10 rounded-md overflow-hidden my-4">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1} // 1:1 aspect ratio for avatars
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onCropComplete={handleCropComplete}
            onZoomChange={setZoom}
          />
        </div>

        <div className="flex items-center gap-4 my-2">
          <ZoomIn className="w-4 h-4 text-muted-foreground" />
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.1}
            onValueChange={(value) => setZoom(value[0])}
            className="flex-1"
          />
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={processCrop} disabled={isProcessing} className="gap-2">
            <Crop className="w-4 h-4" />
            {isProcessing ? 'Processing...' : 'Save Photo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
