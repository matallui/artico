import type { LucideProps } from "lucide-react";
import type { JSX } from "react";
import { User, Video, VideoOff, X } from "lucide-react";

export type Icon = (props: LucideProps) => JSX.Element;

export const Icons = {
  close: X,
  user: User,
  video: Video,
  videoOff: VideoOff,
};
