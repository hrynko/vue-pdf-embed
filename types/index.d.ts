import { DefineComponent } from 'vue';

export interface VuePdfEmbedProps {
  page?: number;
  source: object | string;
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
