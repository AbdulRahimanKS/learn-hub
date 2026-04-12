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
  aspectRatio?: number;
  cropShape?: "rect" | "round";
}

export function ImageCropperModal({
  isOpen,
  onClose,
  imageSrc,
  onCropComplete,
  aspectRatio = 1,
  cropShape = "round",
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
      <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl p-4 sm:p-6 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl">Adjust Image</DialogTitle>
        </DialogHeader>
        
        <div className="relative w-full h-[70vw] sm:h-[300px] max-h-[400px] min-h-[250px] bg-black/10 rounded-xl overflow-hidden my-4">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            cropShape={cropShape}
            showGrid={cropShape === "rect"}
            onCropChange={setCrop}
            onCropComplete={handleCropComplete}
            onZoomChange={setZoom}
          />
        </div>

        <div className="flex items-center gap-4 py-2">
          <ZoomIn className="w-5 h-5 text-muted-foreground" />
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.1}
            onValueChange={(value) => setZoom(value[0])}
            className="flex-1"
          />
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-4">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={processCrop} disabled={isProcessing} className="w-full sm:w-auto gap-2">
            <Crop className="w-4 h-4" />
            {isProcessing ? 'Processing' : 'Save Photo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
