import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-xl border border-gray-100 text-center space-y-6">
                        <div className="mx-auto w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-10 h-10 text-orange-500" />
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-xl font-bold text-gray-900">Sistem Sedang Perbaikan</h1>
                            <p className="text-sm text-gray-500">
                                Mohon maaf, terjadi gangguan teknis. Tim kami sedang menanganinya. Silakan tunggu sebentar dan coba muat ulang halaman.
                            </p>
                        </div>

                        <Button
                            onClick={() => window.location.reload()}
                            className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold"
                        >
                            <RefreshCw className="w-5 h-5 mr-2" />
                            Muat Ulang Halaman
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
