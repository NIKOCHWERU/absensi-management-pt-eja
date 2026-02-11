import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SelectUser } from "@shared/schema";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export function useAuth() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: user, error, isLoading } = useQuery<SelectUser | null>({
    queryKey: ["/api/user"],
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: any) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({ title: "Login Berhasil" });
      setLocation("/");
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || "Username/NIK atau Password salah";
      toast({
        title: "Login Gagal",
        description: message,
        variant: "destructive"
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      setLocation("/login");
      toast({ title: "Logout Berhasil" });
    },
    onError: (error: Error) => {
      toast({ title: "Logout Gagal", description: error.message, variant: "destructive" });
    },
  });

  return {
    user: user ?? null,
    isLoading,
    error,
    loginMutation,
    logoutMutation,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
  };
}
