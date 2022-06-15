import { VueConstructor } from 'vue';

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

export interface VuePdfEmbedMethods {
  print: (dpi?: number, filename?: string) => Promise<void>;
  render: () => Promise<void>;
}

export interface VuePdfEmbedConstructor extends VueConstructor {
  props: VuePdfEmbedProps;
  data: () => VuePdfEmbedData;
  methods: VuePdfEmbedMethods;
}

declare const VuePdfEmbed: VuePdfEmbedConstructor;

export default VuePdfEmbed;
