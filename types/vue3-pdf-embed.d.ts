import { ComputedOptions, DefineComponent, MethodOptions } from 'vue';

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
  pageCount: number | null;
  pageNums: number[];
}

export interface VuePdfEmbedMethods extends MethodOptions {
  print: (dpi?: number, filename?: string, allPages?: boolean) => Promise<void>;
  render: () => Promise<void>;
}

declare const VuePdfEmbed: DefineComponent<
  VuePdfEmbedProps,
  {},
  VuePdfEmbedData,
  ComputedOptions,
  VuePdfEmbedMethods
>;

export default VuePdfEmbed;
