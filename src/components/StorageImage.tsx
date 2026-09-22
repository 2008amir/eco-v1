import type { ImgHTMLAttributes } from "react";
import { useStorageUrl } from "@/lib/storage-url";

type StorageImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  bucket: string;
  path?: string | null;
};

export function StorageImage({ bucket, path, alt = "", ...props }: StorageImageProps) {
  const url = useStorageUrl(bucket, path);

  if (!url) return null;

  return <img src={url} alt={alt} {...props} />;
}