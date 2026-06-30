"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Plus, Newspaper, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { NewsData, AUDIENCE_LABEL, API_BASE } from "./_lib/constants";

export default function NewsPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [news, setNews] = useState<NewsData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasPermission("news.read")) { setLoading(false); return; }
    api.get<NewsData[]>("/news?limit=100")
      .then((res) => setNews((res.data as unknown as NewsData[]) || []))
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hasPermission("news.read")) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-y-3 text-black/40">
        <ShieldOff size={40} />
        <span className="font-bold text-sm">ไม่มีสิทธิ์เข้าถึงหน้านี้</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row items-center justify-between shrink-0 py-5">
        <div className="flex font-bold text-2xl bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent pl-2">
          ข่าวสาร
        </div>
        {hasPermission("news.create") && (
          <Button
            className="border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-4xl font-bold shadow-md"
            startContent={<Plus size={15} />}
            size="md"
            onPress={() => router.push("/news/create")}
          >
            <div className="bg-gradient-to-r from-black/90 to-yellow-600 bg-clip-text text-transparent">
              เพิ่มข่าว
            </div>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-full">
          <Spinner size="lg" color="warning" />
        </div>
      ) : news.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-y-4">
          <Newspaper size={64} className="text-[#c09c42]/30" />
          <span className="text-black/40 text-lg">ยังไม่มีข่าวสาร</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto pb-4">
          {news.map((item) => (
            <div
              key={item.id}
              className="flex flex-col border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-3xl p-5 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.01] gap-y-3"
              onClick={() => router.push(`/news/${item.id}/edit`)}
            >
              <div className="flex flex-row items-center gap-x-3">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${API_BASE}${item.image_url}`}
                    alt={item.title}
                    className="w-12 h-12 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#c09c42]/30 to-transparent flex items-center justify-center shrink-0">
                    <Newspaper size={20} className="text-[#c09c42]" />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-base bg-gradient-to-l from-black/90 to-yellow-600 bg-clip-text text-transparent truncate">
                    {item.title}
                  </span>
                  <span className="text-xs text-black/40">
                    {new Date(item.created_at).toLocaleDateString("th-TH")}
                  </span>
                </div>
              </div>

              <p className="text-sm text-black/60 line-clamp-2">{item.body}</p>

              <Chip size="sm" variant="flat" color="default" className="self-start">
                {AUDIENCE_LABEL[item.audience]}
              </Chip>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
