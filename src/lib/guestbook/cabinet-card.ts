/**
 * Mount a portrait on a vintage cabinet card:
 * cream border (wider at bottom), "Latigo Cowboy Portrait Co.",
 * "El Dorado County, Calif.", double-rule frame.
 */
export async function renderCabinetCard(
  portrait: HTMLImageElement,
  exportWidth = 1600,
): Promise<Blob | null> {
  const aspect = portrait.naturalHeight / Math.max(1, portrait.naturalWidth);
  const imgW = Math.round(exportWidth * 0.82);
  const imgH = Math.round(imgW * aspect);
  const sidePad = Math.round((exportWidth - imgW) / 2);
  const topPad = Math.round(exportWidth * 0.06);
  const bottomPad = Math.round(exportWidth * 0.18);
  const canvasW = exportWidth;
  const canvasH = topPad + imgH + bottomPad;

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Card stock
  ctx.fillStyle = "#FAF3E3";
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Outer double rule
  ctx.strokeStyle = "#3E2A1E";
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, canvasW - 36, canvasH - 36);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(26, 26, canvasW - 52, canvasH - 52);

  // Portrait inset
  ctx.fillStyle = "#2C1D14";
  ctx.fillRect(sidePad - 2, topPad - 2, imgW + 4, imgH + 4);
  ctx.drawImage(portrait, sidePad, topPad, imgW, imgH);

  // Typography under image
  const textY = topPad + imgH + Math.round(bottomPad * 0.38);
  ctx.fillStyle = "#3E2A1E";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Prefer Rye if loaded
  ctx.font = `400 ${Math.round(exportWidth * 0.038)}px Rye, Georgia, serif`;
  ctx.fillText("Latigo Cowboy Portrait Co.", canvasW / 2, textY);

  ctx.font = `600 ${Math.round(exportWidth * 0.018)}px "Bricolage Grotesque", system-ui, sans-serif`;
  ctx.fillStyle = "#5C4430";
  ctx.fillText("EL DORADO COUNTY, CALIF.", canvasW / 2, textY + Math.round(exportWidth * 0.04));

  // Small flourish line
  const lineY = textY + Math.round(exportWidth * 0.07);
  ctx.strokeStyle = "#8A6B4F";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(canvasW * 0.28, lineY);
  ctx.lineTo(canvasW * 0.72, lineY);
  ctx.stroke();

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
}

export function makeShareToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}
