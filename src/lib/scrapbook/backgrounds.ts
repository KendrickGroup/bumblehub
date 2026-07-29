import type { CSSProperties } from "react";
import type { ScrapbookBgId } from "./types";

export const BACKGROUNDS: {
  id: ScrapbookBgId;
  label: string;
}[] = [
  { id: "barnwood", label: "Barnwood" },
  { id: "cork", label: "Cork" },
  { id: "linen", label: "Cream linen" },
  { id: "chalkboard", label: "Chalkboard" },
  { id: "honey", label: "Honey" },
];

/** CSS for display surface (percentage-based patterns). */
export function backgroundCss(id: ScrapbookBgId): CSSProperties {
  switch (id) {
    case "barnwood":
      return {
        backgroundColor: "#8B5E3C",
        backgroundImage: `
          repeating-linear-gradient(
            90deg,
            transparent 0 48px,
            rgba(0,0,0,0.18) 48px 50px
          ),
          linear-gradient(
            180deg,
            #A4724A 0%,
            #8B5E3C 40%,
            #734A30 100%
          )
        `,
      };
    case "cork":
      return {
        backgroundColor: "#C4A574",
        backgroundImage: `
          radial-gradient(circle at 20% 30%, rgba(90,60,30,0.18) 0 2px, transparent 3px),
          radial-gradient(circle at 70% 55%, rgba(90,60,30,0.14) 0 1.5px, transparent 3px),
          radial-gradient(circle at 40% 80%, rgba(90,60,30,0.16) 0 2px, transparent 3px),
          radial-gradient(circle at 85% 20%, rgba(90,60,30,0.12) 0 1px, transparent 2px),
          linear-gradient(160deg, #D4B896, #B89568)
        `,
        backgroundSize: "80px 80px, 60px 60px, 100px 100px, 50px 50px, auto",
      };
    case "linen":
      return {
        backgroundColor: "#F3EDE2",
        backgroundImage: `
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            rgba(180,160,130,0.08) 3px 4px
          ),
          repeating-linear-gradient(
            90deg,
            transparent,
            transparent 3px,
            rgba(180,160,130,0.06) 3px 4px
          )
        `,
      };
    case "chalkboard":
      return {
        backgroundColor: "#2A2E2C",
        backgroundImage: `
          radial-gradient(circle at 30% 40%, rgba(255,255,255,0.04) 0 1px, transparent 2px),
          radial-gradient(circle at 70% 70%, rgba(255,255,255,0.03) 0 1px, transparent 2px),
          linear-gradient(165deg, #333836, #1F2321)
        `,
      };
    case "honey":
      return {
        background: "linear-gradient(145deg, #FBF0D0 0%, #F4B400 55%, #E0972B 100%)",
      };
  }
}

/** Draw background onto a 2D canvas for flatten export. */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  id: ScrapbookBgId,
  w: number,
  h: number,
) {
  switch (id) {
    case "barnwood": {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#A4724A");
      g.addColorStop(0.4, "#8B5E3C");
      g.addColorStop(1, "#734A30");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const plank = w / 12;
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      for (let x = plank; x < w; x += plank) {
        ctx.fillRect(x - 1, 0, 2, h);
      }
      break;
    }
    case "cork": {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#D4B896");
      g.addColorStop(1, "#B89568");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 220; i++) {
        const x = ((i * 97) % w) + (i % 7);
        const y = ((i * 53) % h) + (i % 5);
        ctx.fillStyle = `rgba(90,60,30,${0.08 + (i % 5) * 0.02})`;
        ctx.beginPath();
        ctx.arc(x, y, 1 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "linen": {
      ctx.fillStyle = "#F3EDE2";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(180,160,130,0.12)";
      ctx.lineWidth = 1;
      for (let y = 0; y < h; y += 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let x = 0; x < w; x += 4) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      break;
    }
    case "chalkboard": {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#333836");
      g.addColorStop(1, "#1F2321");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 80; i++) {
        ctx.fillStyle = "rgba(255,255,255,0.035)";
        ctx.fillRect((i * 79) % w, (i * 41) % h, 1, 1);
      }
      break;
    }
    case "honey": {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#FBF0D0");
      g.addColorStop(0.55, "#F4B400");
      g.addColorStop(1, "#E0972B");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
  }
}
