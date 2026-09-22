/**
 * Which build is live.
 *
 * Standing rule: this never renders on screen. It goes out as a meta tag in the
 * document head (see app/layout.tsx), so a deploy can be confirmed with view
 * source or curl without a stamp sitting on the cabinet.
 */

export const BUILD_SHA = (process.env.NEXT_PUBLIC_BUILD_SHA || "dev")
  .trim()
  .slice(0, 7);

export const BUILD_TIME_ISO = process.env.NEXT_PUBLIC_BUILD_TIME ?? "";
