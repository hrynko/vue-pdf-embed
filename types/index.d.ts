import { VueConstructor } from 'vue';

export default VuePdfEmbed;
export const VuePdfEmbed: VuePdfEmbedConstructor;

export interface VuePdfEmbedProps {
  page?: number;
  source: object | string;
}

export interface VuePdfEmbedData {
  document: object | null;
  pageCount: number;
  pageNums: number[];
}

export interface VuePdfEmbedMethods {
  load: Promise<void>;
  render: Promise<void>;
}

export interface VuePdfEmbedConstructor extends VueConstructor {
  props: VuePdfEmbedProps;
  data: () => VuePdfEmbedData;
  methods: VuePdfEmbedMethods;
}
