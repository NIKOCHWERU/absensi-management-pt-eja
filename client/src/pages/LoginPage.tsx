import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, User, Mail, Lock, Loader2, Eye, EyeOff, Download } from "lucide-react";
import { useState } from "react";
import { Redirect } from "wouter";
import { usePWAInstall } from "@/hooks/use-pwa-install";

const loginSchema = z.object({
  username: z.string().min(1, "Wajib diisi"),
  password: z.string().min(1, "Wajib diisi"),
});

export default function LoginPage() {
  const { login, isLoggingIn, user } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const { isInstallable, installApp } = usePWAInstall();

  if (user) {
    return <Redirect to="/" />;
  }

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    try {
      await login(values);
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.error("Role mismatch:", error.response.data.message);
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {isInstallable && (
          <div className="flex justify-center mb-6">
            <Button
              onClick={installApp}
              variant="outline"
              className="rounded-full bg-white/80 backdrop-blur-sm border-orange-200 text-orange-700 hover:bg-orange-50 gap-2 shadow-sm"
            >
              <Download className="w-4 h-4" />
              Pasang Aplikasi (Install App)
            </Button>
          </div>
        )}

        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex mb-4">
            <img
              src="/logo_elok_buah.jpg"
              alt="Logo PT Elok Jaya Abadhi"
              className="w-24 h-24 object-contain rounded-2xl shadow-lg bg-white p-2"
            />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-gray-900 drop-shadow-sm">
            Absensi Management
          </h1>
          <p className="text-muted-foreground font-medium uppercase tracking-wider">PT ELOK JAYA ABADHI</p>
        </div>

        <LoginCard
          onSubmit={(v: any) => onSubmit(v)}
          isLoading={isLoggingIn}
          form={form}
          icon={<User className="w-4 h-4" />}
          placeholder="Masukkan NIK atau Username"
          showPassword={showPassword}
          setShowPassword={setShowPassword}
        />

        <p className="text-center text-xs text-muted-foreground mt-8 opacity-60">
          &copy; {new Date().getFullYear()} PT ELOK JAYA ABADHI. Seluruh hak cipta dilindungi.
        </p>
      </div>
    </div>
  );
}

function LoginCard({ onSubmit, isLoading, form, icon, placeholder, showPassword, setShowPassword }: any) {
  return (
    <Card className="border-border/50 shadow-xl">
      <CardHeader>
        <CardTitle>Login</CardTitle>
        <CardDescription>Silakan masuk ke akun Anda</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username / NIK</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <div className="absolute left-3 top-3 text-muted-foreground">
                        {icon}
                      </div>
                      <Input placeholder={placeholder} className="pl-9 h-11" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <div className="absolute left-3 top-3 text-muted-foreground">
                        <Lock className="w-4 h-4" />
                      </div>
                      <Input type={showPassword ? "text" : "password"} placeholder="••••••••" className="pl-9 pr-10 h-11" {...field} />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading} className="w-full h-11 text-base font-semibold mt-2 shadow-lg shadow-primary/20">
              {isLoading ? <Loader2 className="animate-spin" /> : "Masuk"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
