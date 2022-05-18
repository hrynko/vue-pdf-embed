import { DefineComponent } from 'vue';

export interface VuePdfEmbedProps {
  disableAnnotationLayer?: boolean;
  disableTextLayer?: boolean;
  height?: number | string;
  imageResourcesPath?: string;
  page?: number;
  rotation?: number | string;
  source: object | string | Uint8Array;
  width?: number | string;
}

export interface VuePdfEmbedData {
  document: object | null;
  pageCount: number;
  pageNums: number[];
}

export const VuePdfEmbed: DefineComponent<
  VuePdfEmbedProps,
  unknown,
  VuePdfEmbedData
>;

export default VuePdfEmbed;
