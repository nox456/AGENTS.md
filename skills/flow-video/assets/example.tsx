import { FONT, VIEW_H, VIEW_W } from "../kit";

/* Example only: delete it once the first real screen exists.
   A screen is a pure function of its state props, laid out in viewport CSS px
   with the numbers of the app's own classes (p-6 → 24, h-9 → 36, text-sm → 14/20). */

const PAD = 24;
const BUTTON = { w: 66, h: 36 };

/** Where the cursor aims: computed from the layout numbers, never read off a still. */
export const EXAMPLE_SAVE = { x: VIEW_W - PAD - BUTTON.w / 2, y: PAD + BUTTON.h / 2 };

export const ExamplePage = ({ saved, pressed }: { saved: boolean; pressed: boolean }) => (
  <div
    style={{
      width: VIEW_W,
      height: VIEW_H,
      boxSizing: "border-box",
      padding: PAD,
      background: "#FAFAFA",
      fontFamily: FONT,
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontSize: 30, lineHeight: "36px", fontWeight: 700, color: "#171717" }}>Settings</div>
      <div
        style={{
          width: BUTTON.w,
          height: BUTTON.h,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#4252FF",
          color: "#FAFAFA",
          fontSize: 14,
          fontWeight: 500,
          filter: pressed ? "brightness(0.9)" : undefined,
        }}
      >
        {saved ? "Saved" : "Save"}
      </div>
    </div>
  </div>
);
