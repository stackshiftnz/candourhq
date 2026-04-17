"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type BrandProfile = {
  id: string;
  name: string;
  language_variant: string;
  tone: string;
  is_default: boolean;
};

const LANG_LABELS: Record<string, string> = {
  "en-US": "US English",
  "en-GB": "British English",
};

const DEFAULT_BANNED_PHRASES = [
  "leverage",
  "cutting-edge",
  "synergies",
  "going forward",
  "circle back",
  "deep dive",
];

export default function BrandProfilesListPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profiles, setProfiles] = useState<BrandProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Get user and fetch profiles
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      supabase
        .from("brand_profiles")
        .select("id, name, language_variant, tone, is_default")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .then(({ data }) => {
          setProfiles(data ?? []);
          setLoading(false);
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleNewProfile() {
    if (creating || !userId) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("brand_profiles")
      .insert({
        user_id: userId,
        name: "New profile",
        language_variant: "en-US",
        tone: "conversational",
        is_default: false,
        banned_phrases: DEFAULT_BANNED_PHRASES,
        approved_phrases: [],
        writing_examples: [],
      })
      .select("id")
      .single();

    setCreating(false);
    if (!error && data) {
      router.push(`/settings/brand/${data.id}`);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto">
      {/* Topbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 lg:px-8 h-14 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <h1 className="text-[15px] font-semibold text-gray-900">
          Brand profiles
        </h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleNewProfile}
          loading={creating}
        >
          + New profile
        </Button>
      </div>

      {/* Profile list */}
      <div className="flex-1 px-4 lg:px-8 py-6 max-w-2xl">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 bg-gray-50 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-5 px-8 border border-gray-100 rounded-3xl shadow-sm bg-white">
            <p className="text-[17px] font-bold text-brand-dark">No brand profiles found.</p>
            <Button
              variant="brand"
              size="lg"
              className="h-12 px-6"
              onClick={handleNewProfile}
              loading={creating}
            >
              Create your first profile
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {profiles.map((profile) => (
              <li
                key={profile.id}
                className="border border-gray-100 rounded-xl px-5 py-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-medium text-gray-900 truncate">
                      {profile.name}
                    </p>
                    {profile.is_default && (
                      <Badge variant="success" size="sm">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-[12px] text-gray-400 mt-0.5">
                    {LANG_LABELS[profile.language_variant] ??
                      profile.language_variant}{" "}
                    · {profile.tone}
                  </p>
                </div>
                <Link
                  href={`/settings/brand/${profile.id}`}
                  className="flex-shrink-0"
                >
                  <Button variant="secondary" size="sm">
                    Edit
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Bottom padding for mobile nav */}
        <div className="h-8" />
      </div>
    </div>
  );
}
