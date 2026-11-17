import { useState, type ImgHTMLAttributes } from "react";
import { ImageOff } from "lucide-react";
import { useStorageUrl } from "@/lib/storage-url";

type StorageImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  bucket: string;
  path?: string | null;
};

export function StorageImage({ bucket, path, alt = "", className, ...props }: StorageImageProps) {
  const url = useStorageUrl(bucket, path);
  const [failed, setFailed] = useState<string | null>(null);

  if (!url || failed === url) {
    return (
      <div className={`${className ?? ""} flex items-center justify-center bg-muted text-muted-foreground`}>
        <ImageOff className="h-1/3 w-1/3" />
      </div>
    );
  }

  return <img src={url} alt={alt} className={className} onError={() => setFailed(url)} {...props} />;
}
