import { format } from "date-fns";
import { id } from "date-fns/locale";

export async function drawWatermark(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    location: string
) {
    // 1. Draw Semi-transparent background at bottom 
    // Height depends on resolution. 
    // For 640x480, height 480. Footer 120px.
    // For HD, taller.
    const padding = width * 0.02;
    const footerHeight = Math.max(55, height * 0.10);

    // Gradient background for better visibility
    const gradient = ctx.createLinearGradient(0, height - footerHeight, 0, height);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.2)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.7)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, height - footerHeight, width, footerHeight);

    // 2. Load and Draw Logo
    try {
        const logo = await new Promise<HTMLImageElement>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => resolve(img); // Resolve even if error to continue
            img.src = "/logo_elok_buah.jpg";
        });

        let textX = padding;

        if (logo.width > 0) {
            const logoSize = footerHeight * 0.55; // 55% of footer (smaller)
            const logoY = height - footerHeight + (footerHeight - logoSize) / 2;
            const logoAspect = logo.width / logo.height;
            const logoWidth = logoSize * logoAspect;

            ctx.drawImage(logo, padding, logoY, logoWidth, logoSize);
            textX = padding + logoWidth + padding;
        }

        // 3. Draw Text
        ctx.fillStyle = "white";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        // Font sizes (smaller)
        const fontSizeDate = Math.max(11, height * 0.028);
        const fontSizeLocation = Math.max(9, height * 0.02);

        const now = new Date();
        const dateStr = format(now, "EEEE, d MMMM yyyy", { locale: id });
        const timeStr = format(now, "HH:mm:ss", { locale: id });

        // Line 1: DateTime
        ctx.font = `bold ${fontSizeDate}px sans-serif`;
        const dateY = height - footerHeight * 0.65;
        ctx.fillText(`${dateStr} • ${timeStr}`, textX, dateY);

        // Line 2: Location
        ctx.font = `${fontSizeLocation}px sans-serif`;
        const locY = height - footerHeight * 0.35;

        const locText = location || "Lokasi tidak tersedia";
        // Simple truncation if too long
        const maxTextWidth = width - textX - padding;
        let displayLoc = locText;
        if (ctx.measureText(locText).width > maxTextWidth) {
            // Very basic truncation logic
            const avgCharWidth = ctx.measureText("A").width;
            const maxChars = Math.floor(maxTextWidth / avgCharWidth);
            displayLoc = locText.substring(0, maxChars - 3) + "...";
        }
        ctx.fillText(displayLoc, textX, locY);

    } catch (e) {
        console.error("Watermark error:", e);
    }
}
