import { Composition } from "remotion";
import { Video } from "./Video";
import { DURATION } from "./timeline";
import { FPS, FRAME_H, FRAME_W } from "./kit";

export const Root = () => (
  <Composition id="__ID__" component={Video} durationInFrames={DURATION} fps={FPS} width={FRAME_W} height={FRAME_H} />
);
