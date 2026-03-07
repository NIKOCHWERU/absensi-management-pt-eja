import { useState, useEffect } from "react";

// Define the type for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: Array<string>;
    readonly userChoice: Promise<{
        outcome: "accepted" | "dismissed";
        platform: string;
    }>;
    prompt(): Promise<void>;
}

export function usePWAInstall() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        const dismissed = localStorage.getItem("pwa-install-dismissed");
        if (dismissed) setIsDismissed(true);

        const handler = (e: Event) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setIsInstallable(true);
            console.log("PWA install prompt is ready.");
        };

        window.addEventListener("beforeinstallprompt", handler);

        // Optionally handle successful install
        const appInstalledHandler = () => {
            setDeferredPrompt(null);
            setIsInstallable(false);
            console.log("PWA was installed");
        };
        window.addEventListener("appinstalled", appInstalledHandler);

        return () => {
            window.removeEventListener("beforeinstallprompt", handler);
            window.removeEventListener("appinstalled", appInstalledHandler);
        };
    }, []);

    const installApp = async () => {
        if (!deferredPrompt) {
            // In iOS or non-supported browsers, we show an alert instructing how to install
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
            if (isIOS) {
                alert("Untuk install di iOS: Tekan tombol Share (panah atas) di menu bawah Safari, lalu pilih 'Add to Home Screen'.");
            } else {
                alert("Browser Anda mungkin tidak mendukung instalasi langsung atau aplikasi sudah terpasang. Coba periksa menu browser untuk 'Install App'.");
            }
            return;
        }

        // Show the install prompt
        await deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const choiceResult = await deferredPrompt.userChoice;

        if (choiceResult.outcome === "accepted") {
            console.log("User accepted the install prompt");
        } else {
            console.log("User dismissed the install prompt");
        }

        // We can't use the prompt again
        setDeferredPrompt(null);
        setIsInstallable(false);
    };

    const dismissInstall = () => {
        localStorage.setItem("pwa-install-dismissed", "true");
        setIsDismissed(true);
    };

    // Detect if running in standalone mode (installed as PWA)
    const isStandalone = typeof window !== 'undefined' &&
        (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);

    // On iOS, PWA requires manual installation.
    const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream && !isStandalone;

    return {
        isInstallable: (isInstallable || isIOS) && !isStandalone && !isDismissed,
        installApp,
        isIOS,
        isStandalone,
        dismissInstall
    };
}
