export interface GalleryScene {
  id: string;
  number: number;
  order?: number;
  original: string;
  remaster: string;
  thumbnail: string;
  aiTool?: string;
  createdAt: string;
  width?: number;
  height?: number;
}

export interface GalleryGame {
  slug: string;
  title: string;
  order?: number;
  scenes: GalleryScene[];
}

export interface GalleryDataManifest {
  version: 1;
  updatedAt: string;
  games: GalleryGame[];
}

export interface GalleryItem {
  id: string;
  order?: number;
  title: string;
  scene?: string;
  aliases: string[];
  originalImage: string;
  remasteredImage: string;
  thumbnailImage?: string;
  aiTool?: string;
  creator?: string;
  searchText: string;
  width?: number;
  height?: number;
}

export interface GalleryManifest {
  generatedAt: string;
  items: GalleryItem[];
}
