export type SlideshowPhoto = {
  id: string;
  displayUrl: string;
  caption: string | null;
  taken_at: string | null;
  created_at: string;
};

export type StyleSlideshowProps = {
  photos: SlideshowPhoto[];
  paused: boolean;
  preload: (url: string) => void;
  refetchPhotos: () => Promise<SlideshowPhoto[]>;
};
