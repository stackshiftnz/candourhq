"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getWordCount } from "@/lib/utils/word-count";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/lib/hooks/useToast";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { ContentType } from "@/lib/anthropic/types";
import { Database } from "@/types/database";

type BrandProfile = Database["public"]["Tables"]["brand_profiles"]["Row"];

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "blog_post", label: "Blog post" },
  { value: "email", label: "Email" },
  { value: "report", label: "Report" },
  { value: "proposal", label: "Proposal" },
  { value: "press_release", label: "Press release" },
  { value: "social_post", label: "Social post" },
  { value: "memo", label: "Memo" },
];

const MOBILE_CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "blog_post", label: "Blog post" },
  { value: "email", label: "Email" },
  { value: "report", label: "Report" },
  { value: "proposal", label: "Proposal" },
  { value: "social_post", label: "Social" },
  { value: "memo", label: "Memo" },
];

// SVGs
const DocumentIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
);
const UploadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
);
const PencilIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
);
const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);

export default function NewDocumentPage() {
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState("paste");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const { toast } = useToast();
  const [contentType, setContentType] = useState<ContentType>("blog_post");
  const [isManualType, setIsManualType] = useState(false);
  const [profiles, setProfiles] = useState<BrandProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>("");
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [detectionState, setDetectionState] = useState<"auto" | "detected" | "manual">("auto");
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  
  const detectionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch brand profiles
  useEffect(() => {
    async function fetchProfiles() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("brand_profiles")
        .select("*")
        .order("is_default", { ascending: false });

      if (data) {
        setProfiles(data);
        if (data.length > 0) {
          setActiveProfileId(data[0].id);
        }
      }
    }
    fetchProfiles();
  }, [supabase]);

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  const wordCount = getWordCount(content);

  const handleAnalyse = async () => {
    if (!content.trim() && activeTab === "paste") return;
    setIsAnalysing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          brand_profile_id: activeProfileId || null,
          title: title || (content.split('\n')[0].substring(0, 50) || "Untitled"),
          content_type: contentType,
          original_content: content,
          word_count: wordCount,
          language_variant: activeProfile?.language_variant || "en-US",
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        router.push(`/analyse/${data.id}`);
      }
    } catch (err) {
      console.error("Analyse error:", err);
      setIsAnalysing(false);
      toast("Analysis failed. Your content has been saved — try again from History.", "error");
    }
  };

  const handleAutoDetect = useCallback(async (text: string) => {
    if (isManualType) return;
    
    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.contentType && !isManualType) {
        setContentType(data.contentType);
        setDetectionState("detected");
      }
    } catch (err) {
      console.error("Auto-detect error:", err);
    }
  }, [isManualType]);

  useEffect(() => {
    if (isManualType) return;
    if (wordCount < 50 && wordCount > 0) {
       // Just wait for 1.5s
    } else if (wordCount === 0) {
      setDetectionState("auto");
      return;
    }

    if (detectionTimerRef.current) clearTimeout(detectionTimerRef.current);
    
    detectionTimerRef.current = setTimeout(() => {
      if (content.trim()) {
        handleAutoDetect(content);
      }
    }, 1500);

    return () => {
      if (detectionTimerRef.current) clearTimeout(detectionTimerRef.current);
    };
  }, [content, wordCount, handleAutoDetect, isManualType]);

  const handleFileUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setParseError("File is too large. Maximum size is 5MB.");
      return;
    }
    
    // Check extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['docx', 'pdf', 'txt'].includes(ext || '')) {
      setParseError("Unsupported file type. Please upload DOCX, PDF, or TXT.");
      return;
    }

    setIsParsing(true);
    setParseError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        setParseError(data.error);
      } else {
        setContent(data.text);
        setActiveTab("paste");
      }
    } catch {
      setParseError("Failed to parse file. Please try again or paste manually.");
    } finally {
      setIsParsing(false);
    }
  };

  const clearContent = () => setContent("");
  const selectAll = () => {
    const el = document.getElementById("paste-textarea") as HTMLTextAreaElement;
    if (el) {
      el.focus();
      el.select();
    }
  };

  const onPaste = async () => {
    // text/plain is used
  };

  const tabs = [
    { id: "paste", label: "Paste text", mobileLabel: "Paste", icon: <DocumentIcon /> },
    { id: "upload", label: "Upload file", mobileLabel: "Upload", icon: <UploadIcon /> },
    { id: "write", label: "Write here", mobileLabel: "Write", icon: <PencilIcon /> },
  ];

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Topbar */}
      <div className="h-[48px] flex items-center justify-between px-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center">
          <h1 className="text-[13px] font-medium text-gray-900 lg:mr-4">New document</h1>
          <span className="lg:hidden text-[12px] text-gray-400">
            {activeProfile?.name || "Loading..."}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Desktop Controls */}
          <div className="hidden lg:flex items-center space-x-3">
            <Select
              className="w-[140px] h-8 py-0"
              value={contentType}
              onChange={(e) => {
                setContentType(e.target.value as ContentType);
                setIsManualType(true);
                setDetectionState("manual");
              }}
              options={CONTENT_TYPES}
            />
            <Select
              className="w-[160px] h-8 py-0"
              value={activeProfileId}
              onChange={(e) => setActiveProfileId(e.target.value)}
              options={profiles.map(p => ({ value: p.id, label: p.name }))}
            />
          </div>
          {/* Mobile Settings Toggle */}
          <button 
            onClick={() => setShowMobileSettings(true)}
            className="lg:hidden p-1.5 border border-gray-200 rounded-md text-gray-500"
          >
            <SettingsIcon />
          </button>
        </div>
      </div>

      {/* Mobile Content Type Chips */}
      <div className="lg:hidden border-b border-gray-100 bg-white overflow-x-auto no-scrollbar py-2 px-4 flex items-center space-x-2 flex-shrink-0">
        {MOBILE_CONTENT_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => {
              setContentType(type.value);
              setIsManualType(true);
              setDetectionState("manual");
            }}
            className={cn(
              "whitespace-nowrap h-11 px-4 rounded-full text-[12px] transition-colors flex items-center justify-center",
              contentType === type.value
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 border border-gray-200"
            )}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="flex-shrink-0" />

      {/* Content Area */}
      <div className="flex-1 overflow-auto relative flex flex-col">
        {activeTab === "paste" && (
          <div className="flex-1 flex flex-col h-full">
            <div className="h-[34px] bg-gray-50 border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
              <div className="flex items-center space-x-4">
                <button 
                  className="text-[12px] text-gray-600 hover:text-gray-900 p-2 -m-2 mr-2"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setContent(text);
                    } catch {
                      // Silently fail if clipboard access is denied
                    }
                  }}
                >
                  Paste
                </button>
                <button className="text-[12px] text-gray-600 hover:text-gray-900 p-2 -m-2 mr-2" onClick={clearContent}>Clear</button>
                <button className="text-[12px] text-gray-600 hover:text-gray-900 p-2 -m-2 hidden sm:inline" onClick={selectAll}>Select all</button>
              </div>
              <span className="text-[12px] text-gray-400">{wordCount} words</span>
            </div>
            <textarea
              id="paste-textarea"
              className="flex-1 w-full p-4 resize-none focus:outline-none text-[14px] leading-relaxed placeholder:text-gray-300"
              placeholder={`Paste your AI-generated content here\u2026\n\nBlog posts, emails, reports, proposals, press releases \u2014 any text you want to diagnose and clean.`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={onPaste}
            />
          </div>
        )}

        {activeTab === "upload" && (
          <div 
            className="flex-1 p-4 lg:p-8 flex flex-col"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFileUpload(file);
            }}
          >
            <div className="flex-1 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-center p-6 transition-colors hover:border-gray-400">
              {isParsing ? (
                <div className="w-full max-w-xs space-y-4">
                  <Spinner className="w-8 h-8 mx-auto text-gray-900" />
                  <p className="text-sm text-gray-600 font-medium">Parsing document...</p>
                  <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                    <div className="bg-gray-900 h-full animate-progress" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-9 h-9 border border-gray-200 rounded-lg flex items-center justify-center mb-4 text-gray-400">
                    <UploadIcon />
                  </div>
                  <h3 className="text-[14px] font-medium text-gray-900 mb-1">Drop your file here</h3>
                  <p className="text-[13px] text-gray-500 max-w-[280px] mb-6">
                    Or browse to find it on your computer. Candour reads the text &mdash; formatting is stripped on import.
                  </p>
                  <div className="flex items-center space-x-2 mb-8">
                    {["DOCX", "PDF", "TXT"].map(p => (
                      <span key={p} className="px-2 py-0.5 bg-gray-50 border border-gray-200 rounded text-[12px] text-gray-400 font-bold">{p}</span>
                    ))}
                  </div>
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept=".docx,.pdf,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />
                  <Button 
                    variant="secondary" 
                    className="height-[32px] px-6 text-[13px]"
                    onClick={() => document.getElementById("file-upload")?.click()}
                  >
                    Browse files
                  </Button>
                  {parseError && (
                    <p className="mt-4 text-sm text-red-500 bg-red-50 px-3 py-2 rounded-md border border-red-100">{parseError}</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === "write" && (
          <div className="flex-1 flex flex-col h-full">
            <input
              type="text"
              placeholder="Document title (optional)"
              className="h-[42px] px-4 border-b border-gray-100 text-[14px] font-medium focus:outline-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="h-11 bg-gray-50 border-b border-gray-200 flex items-center px-2 space-x-1 overflow-x-auto no-scrollbar flex-shrink-0">
               {["B", "I", "U"].map(f => (
                 <button key={f} className="w-11 h-11 flex items-center justify-center text-[13px] font-bold text-gray-600 hover:bg-gray-200 rounded transition-colors">{f}</button>
               ))}
               <div className="w-[1px] h-4 bg-gray-200 mx-1" />
               {["H1", "H2"].map(f => (
                 <button key={f} className="h-11 px-3 flex items-center justify-center text-[12px] font-bold text-gray-600 hover:bg-gray-200 rounded transition-colors">{f}</button>
               ))}
               <div className="w-[1px] h-4 bg-gray-200 mx-1" />
               <button className="w-11 h-11 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded transition-colors">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
               </button>
            </div>
            <textarea
              className="flex-1 w-full p-4 resize-none focus:outline-none text-[14px] leading-relaxed placeholder:text-gray-300"
              placeholder={`Start writing here\u2026\n\nCandour will diagnose your content as if it were AI-generated \u2014 useful for checking any writing before it goes out.`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Word-count warnings — short or long content affects analysis quality */}
      {wordCount > 0 && wordCount < 50 && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-900 flex-shrink-0">
          Short content (under 50 words) may produce unreliable diagnosis. Consider adding more context.
        </div>
      )}
      {wordCount > 3000 && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-900 flex-shrink-0">
          Long content ({wordCount.toLocaleString()} words) will take longer to process. For best results, consider splitting into sections under 3,000 words.
        </div>
      )}

      {/* Footer */}
      <div className="h-[52px] sm:h-[56px] border-t border-gray-200 flex items-center justify-between px-4 bg-white flex-shrink-0">
        <div className="flex items-center text-[12px] text-gray-500 overflow-hidden whitespace-nowrap">
          <span className="flex-shrink-0">
            {detectionState === "manual" ? `Set to: ${contentType.replace('_', ' ')}` : 
             detectionState === "detected" ? `Detected: ${contentType.replace('_', ' ')}` : 
             "Detected: auto"}
          </span>
          <div className="hidden sm:block w-[1px] h-3 bg-gray-200 mx-3 flex-shrink-0" />
          <span className="hidden sm:block truncate opacity-60">
            {activeProfile?.name || "Loading profile..."}
          </span>
        </div>

        <Button
          className={cn(
            "h-11 px-6 text-[13px] font-medium transition-all shadow-sm",
            isAnalysing && "opacity-50 cursor-not-allowed"
          )}
          disabled={isAnalysing || (activeTab === "paste" && !content.trim())}
          onClick={handleAnalyse}
        >
          {isAnalysing ? (
             <div className="flex items-center space-x-2">
               <Spinner className="w-3.5 h-3.5" />
               <span className="hidden sm:inline">Analysing...</span>
               <span className="sm:hidden">Analyse</span>
             </div>
          ) : (
            <>
              <span className="hidden sm:inline">Analyse content</span>
              <span className="sm:hidden">Analyse</span>
            </>
          )}
        </Button>
      </div>

      {/* Mobile Settings Bottom Sheet Overlay */}
      {showMobileSettings && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 lg:hidden">
           <div className="bg-white rounded-t-2xl p-6 shadow-xl animate-slide-up max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Document settings</h3>
                <button onClick={() => setShowMobileSettings(false)} className="text-gray-400 p-1">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Content type</label>
                  <Select
                    value={contentType}
                    onChange={(e) => {
                      setContentType(e.target.value as ContentType);
                      setIsManualType(true);
                      setDetectionState("manual");
                    }}
                    options={CONTENT_TYPES}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Brand profile</label>
                  <Select
                    value={activeProfileId}
                    onChange={(e) => setActiveProfileId(e.target.value)}
                    options={profiles.map(p => ({ value: p.id, label: p.name }))}
                  />
                </div>
                <Button 
                  className="w-full mt-4 h-12 text-base font-bold"
                  onClick={() => setShowMobileSettings(false)}
                >
                  Apply settings
                </Button>
              </div>
           </div>
        </div>
      )}

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-progress {
          animation: progress 1.5s infinite linear;
          width: 50%;
        }
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
