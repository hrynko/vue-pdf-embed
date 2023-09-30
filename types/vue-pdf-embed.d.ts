import { ComputedOptions, DefineComponent, MethodOptions } from 'vue';

export interface VuePdfEmbedProps {
  annotationLayer?: boolean;
  height?: number | string;
  imageResourcesPath?: string;
  page?: number;
  rotation?: number | string;
  source: object | string | URL | Uint8Array;
  textLayer?: boolean;
  width?: number | string;
}

export interface VuePdfEmbedData {
  document: object | null;
  pageCount: number | null;
  pageNums: number[];
}

export interface VuePdfEmbedMethods extends MethodOptions {
  download: (filename?: string) => Promise<void>;
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
