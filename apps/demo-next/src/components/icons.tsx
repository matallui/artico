import type { LucideProps } from "lucide-react";
import { X, User, Video, VideoOff } from "lucide-react";

export type Icon = (props: LucideProps) => JSX.Element;

export const Icons = {
  close: X,
  user: User,
  video: Video,
  videoOff: VideoOff,
};
