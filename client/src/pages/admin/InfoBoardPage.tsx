import { useQuery, useMutation } from "@tanstack/react-query";
import { Announcement } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { 
    ArrowLeft, 
    Plus, 
    Trash2, 
    Calendar, 
    Image as ImageIcon,
    Loader2 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

// Schema for form since we handle file upload manually
const formSchema = z.object({
  title: z.string().min(1, "Judul wajib diisi"),
  content: z.string().min(1, "Konten wajib diisi"),
  expiresAt: z.string().optional(), // Date string from input type="date"
});

export default function InfoBoardPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const { data: announcements, isLoading } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      content: "",
      expiresAt: "",
    }
  });

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
        const formData = new FormData();
        formData.append("title", values.title);
        formData.append("content", values.content);
        if (values.expiresAt) {
            formData.append("expiresAt", values.expiresAt);
        }
        if (selectedImage) {
            formData.append("image", selectedImage);
        }

        const res = await fetch("/api/announcements", {
            method: "POST",
            body: formData,
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || "Gagal membuat pengumuman");
        }
        return res.json();
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
        toast({ title: "Berhasil", description: "Pengumuman berhasil dibuat" });
        setOpen(false);
        form.reset();
        setSelectedImage(null);
    },
    onError: (err: any) => {
        toast({ title: "Gagal", description: err.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/announcements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      toast({ title: "Berhasil", description: "Pengumuman berhasil dihapus" });
    },
    onError: (err: any) => {
      toast({ title: "Gagal", description: "Gagal menghapus pengumuman", variant: "destructive" });
    }
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
       <header className="bg-white border-b border-gray-200 p-4 px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-gray-800">Papan Informasi</h1>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-orange-600 hover:bg-orange-700 text-white">
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Informasi
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Buat Pengumuman Baru</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Judul</FormLabel>
                                    <FormControl><Input {...field} placeholder="Contoh: Libur Nasional" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="content"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Konten</FormLabel>
                                    <FormControl><Textarea {...field} placeholder="Isi pengumuman..." className="resize-none h-32" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="expiresAt"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tampilkan Sampai (Opsional)</FormLabel>
                                    <FormControl><Input type="date" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="space-y-2">
                            <FormLabel>Gambar (Opsional)</FormLabel>
                            <Input 
                                type="file" 
                                accept="image/*"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setSelectedImage(e.target.files[0]);
                                    }
                                }} 
                            />
                            <p className="text-xs text-muted-foreground">Format: JPG, PNG. Maks 5MB.</p>
                        </div>

                        <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white" disabled={createMutation.isPending}>
                            {createMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                            Simpan Pengumuman
                        </Button>
                    </form>
                </Form>
            </DialogContent>
          </Dialog>
       </header>

       <main className="p-8 flex-1 max-w-5xl mx-auto w-full">
            {isLoading ? (
                <div className="flex justify-center p-10"><Loader2 className="animate-spin text-green-600" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {announcements?.map((item) => (
                        <Card key={item.id} className="overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
                            {item.imageUrl && (
                                <div className="h-48 w-full bg-gray-50 flex items-center justify-center overflow-hidden border-b">
                                    <img src={item.imageUrl} alt={item.title} className="max-w-full max-h-full object-contain" />
                                </div>
                            )}
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-lg line-clamp-2">{item.title}</CardTitle>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-red-500 hover:bg-red-50 -mr-2 -mt-2"
                                        onClick={() => {
                                            if (confirm("Hapus pengumuman ini?")) {
                                                deleteMutation.mutate(item.id);
                                            }
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                <CardDescription className="flex items-center gap-1 text-xs">
                                    <Calendar className="h-3 w-3" />
                                    {item.createdAt && format(new Date(item.createdAt), "d MMM yyyy", { locale: id })}
                                    {item.expiresAt && (
                                        <span className="ml-2 text-green-600 font-medium">
                                            • Berakhir: {format(new Date(item.expiresAt), "d MMM yyyy", { locale: id })}
                                        </span>
                                    )}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1">
                                <p className="text-sm text-gray-600 line-clamp-4 leading-relaxed whitespace-pre-wrap">
                                    {item.content}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                    {announcements?.length === 0 && (
                        <div className="col-span-full text-center py-12 text-gray-500 bg-white rounded-lg border border-dashed">
                            Belum ada pengumuman aktif.
                        </div>
                    )}
                </div>
            )}
       </main>
    </div>
  );
}
