"use client";

import { useEffect, useState } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { ArrowLeft, Save, Trash2, ShieldOff } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useDisclosure } from "@heroui/modal";
import { useAuth } from "@/contexts/auth-context";
import { ConfirmDeleteModal } from "@/components/confirmDeleteModal";
import { Audience, AUDIENCE_OPTIONS, NewsData, API_BASE } from "../../_lib/constants";
import { NewsImagePicker } from "../../_lib/imagePicker";

export default function EditNewsPage() {
  const router = useRouter();
  const params = useParams();
  const newsId = params.id as string;
  const { hasPermission } = useAuth();

  if (!hasPermission("news.update")) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <ShieldOff size={40} />
        <span className="font-bold text-sm">ไม่มีสิทธิ์เข้าถึงหน้านี้</span>
      </div>
    );
  }

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [existingImageUrl, setExistingImageUrl] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const delDisc = useDisclosure();
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get<NewsData>(`/news/${newsId}`).then((res) => {
      const data = res.data as unknown as NewsData;
      if (data) {
        setTitle(data.title);
        setBody(data.body);
        setAudience(data.audience);
        setExistingImageUrl(data.image_url);
      }
    });
  }, [newsId]);

  const imagePreview = image
    ? URL.createObjectURL(image)
    : (existingImageUrl ? `${API_BASE}${existingImageUrl}` : null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return setError("กรุณากรอกหัวข้อและเนื้อหา");
    setError("");
    setLoading(true);
    try {
      await api.put(`/news/${newsId}`, { title, body, audience });
      if (image) {
        const fd = new FormData();
        fd.append("image", image);
        await api.upload(`/news/${newsId}/image`, fd);
      }
      router.push("/news");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "แก้ไขข่าวไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/news/${newsId}`);
      router.push("/news");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "ลบข่าวไม่สำเร็จ");
      delDisc.onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row items-center gap-x-3 shrink-0 py-5">
        <Button isIconOnly variant="light" onPress={() => router.back()} className="text-[#c09c42]">
          <ArrowLeft size={20} />
        </Button>
        <div className="font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent flex-1">
          แก้ไขข่าว
        </div>
        {hasPermission("news.delete") && (
          <Button isIconOnly variant="light" color="danger" onPress={delDisc.onOpen}>
            <Trash2 size={20} />
          </Button>
        )}
      </div>

      <div className="w-full max-w-xl border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-y-4">
          <Input label="หัวข้อข่าว" value={title} onValueChange={setTitle}
            classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} isRequired />
          <Textarea label="เนื้อหาข่าว" value={body} onValueChange={setBody} minRows={6}
            classNames={{ inputWrapper: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }} isRequired />
          <Select
            label="ประชาสัมพันธ์ให้"
            selectedKeys={new Set([audience])}
            onSelectionChange={(keys) => setAudience((Array.from(keys)[0] as Audience) ?? "all")}
            classNames={{ trigger: "bg-gradient-to-br from-black/10 to-transparent border-1 border-black/10 rounded-2xl" }}
          >
            {AUDIENCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.key}>{opt.label}</SelectItem>
            ))}
          </Select>
          <NewsImagePicker
            previewUrl={imagePreview}
            onPick={setImage}
            onClear={() => { setImage(null); setExistingImageUrl(""); }}
          />

          {error && <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</div>}

          <Button type="submit" isLoading={loading}
            className="bg-gradient-to-r from-[#c09c42] to-yellow-600 text-white font-bold rounded-2xl shadow-lg"
            size="lg" startContent={!loading && <Save size={18} />}>
            บันทึก
          </Button>
        </form>
      </div>

      <ConfirmDeleteModal
        isOpen={delDisc.isOpen}
        onClose={delDisc.onClose}
        onConfirm={handleDelete}
        name={title}
        loading={deleting}
      />
    </div>
  );
}
