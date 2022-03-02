import { DefineComponent } from 'vue';

export interface VuePdfEmbedProps {
  disableAnnotationLayer?: Boolean;
  disableTextLayer?: boolean;
  height?: number | string;
  page?: number;
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
