"use client";

import { useEffect, useState } from "react";

/**
 * Official US state flag SVGs in /public/flags/{CODE}.svg.
 * Downloaded 2026-09-16 from Wikimedia Commons and stripped with SVGO.
 *
 * Sources (File: pages; Special:FilePath served the SVG):
 * AL https://commons.wikimedia.org/wiki/File:Flag_of_Alabama.svg
 * AK https://commons.wikimedia.org/wiki/File:Flag_of_Alaska.svg
 * AZ https://commons.wikimedia.org/wiki/File:Flag_of_Arizona.svg
 * AR https://commons.wikimedia.org/wiki/File:Flag_of_Arkansas.svg
 * CA https://commons.wikimedia.org/wiki/File:Flag_of_California.svg
 * CO https://commons.wikimedia.org/wiki/File:Flag_of_Colorado.svg
 * CT https://commons.wikimedia.org/wiki/File:Flag_of_Connecticut.svg
 * DE https://commons.wikimedia.org/wiki/File:Flag_of_Delaware.svg
 * FL https://commons.wikimedia.org/wiki/File:Flag_of_Florida.svg
 * GA https://commons.wikimedia.org/wiki/File:Flag_of_the_State_of_Georgia.svg
 * HI https://commons.wikimedia.org/wiki/File:Flag_of_Hawaii.svg
 * ID https://commons.wikimedia.org/wiki/File:Flag_of_Idaho.svg
 * IL https://commons.wikimedia.org/wiki/File:Flag_of_Illinois.svg
 * IN https://commons.wikimedia.org/wiki/File:Flag_of_Indiana.svg
 * IA https://commons.wikimedia.org/wiki/File:Flag_of_Iowa.svg
 * KS https://commons.wikimedia.org/wiki/File:Flag_of_Kansas.svg
 * KY https://commons.wikimedia.org/wiki/File:Flag_of_Kentucky.svg
 * LA https://commons.wikimedia.org/wiki/File:Flag_of_Louisiana.svg
 * ME https://commons.wikimedia.org/wiki/File:Flag_of_Maine.svg
 * MD https://commons.wikimedia.org/wiki/File:Flag_of_Maryland.svg
 * MA https://commons.wikimedia.org/wiki/File:Flag_of_Massachusetts.svg
 * MI https://commons.wikimedia.org/wiki/File:Flag_of_Michigan.svg
 * MN https://commons.wikimedia.org/wiki/File:Flag_of_Minnesota.svg
 * MS https://commons.wikimedia.org/wiki/File:Flag_of_Mississippi.svg
 * MO https://commons.wikimedia.org/wiki/File:Flag_of_Missouri.svg
 * MT https://commons.wikimedia.org/wiki/File:Flag_of_Montana.svg
 * NE https://commons.wikimedia.org/wiki/File:Flag_of_Nebraska.svg
 * NV https://commons.wikimedia.org/wiki/File:Flag_of_Nevada.svg
 * NH https://commons.wikimedia.org/wiki/File:Flag_of_New_Hampshire.svg
 * NJ https://commons.wikimedia.org/wiki/File:Flag_of_New_Jersey.svg
 * NM https://commons.wikimedia.org/wiki/File:Flag_of_New_Mexico.svg
 * NY https://commons.wikimedia.org/wiki/File:Flag_of_New_York.svg
 * NC https://commons.wikimedia.org/wiki/File:Flag_of_North_Carolina.svg
 * ND https://commons.wikimedia.org/wiki/File:Flag_of_North_Dakota.svg
 * OH https://commons.wikimedia.org/wiki/File:Flag_of_Ohio.svg
 * OK https://commons.wikimedia.org/wiki/File:Flag_of_Oklahoma.svg
 * OR https://commons.wikimedia.org/wiki/File:Flag_of_Oregon.svg
 * PA https://commons.wikimedia.org/wiki/File:Flag_of_Pennsylvania.svg
 * RI https://commons.wikimedia.org/wiki/File:Flag_of_Rhode_Island.svg
 * SC https://commons.wikimedia.org/wiki/File:Flag_of_South_Carolina.svg
 * SD https://commons.wikimedia.org/wiki/File:Flag_of_South_Dakota.svg
 * TN https://commons.wikimedia.org/wiki/File:Flag_of_Tennessee.svg
 * TX https://commons.wikimedia.org/wiki/File:Flag_of_Texas.svg
 * UT https://commons.wikimedia.org/wiki/File:Flag_of_Utah.svg
 * VT https://commons.wikimedia.org/wiki/File:Flag_of_Vermont.svg
 * VA https://commons.wikimedia.org/wiki/File:Flag_of_Virginia.svg
 * WA https://commons.wikimedia.org/wiki/File:Flag_of_Washington.svg
 * WV https://commons.wikimedia.org/wiki/File:Flag_of_West_Virginia.svg
 * WI https://commons.wikimedia.org/wiki/File:Flag_of_Wisconsin.svg
 * WY https://commons.wikimedia.org/wiki/File:Flag_of_Wyoming.svg
 */
const FLAG_FILES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

export function StateFlagIcon({
  code,
}: {
  code: string | null | undefined;
}) {
  const key = code?.trim().toUpperCase() ?? "";
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [key]);

  if (!key || failed || !FLAG_FILES.has(key)) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/flags/${key}.svg`}
      alt=""
      aria-hidden
      className="radio-stateflag"
      onError={() => setFailed(true)}
    />
  );
}
