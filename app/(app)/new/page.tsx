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
import { 
  FileText, 
  Upload, 
  Edit2, 
  Settings, 
  X, 
  Clipboard, 
  Trash2, 
  Scaling, 
  Type, 
  ArrowRight, 
  Sparkles,
  Briefcase
} from "lucide-react";

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


  // ── Render ──────────────────────────────────────────────────────────────────

  const tabs = [
    { id: "paste", label: "Paste Text", mobileLabel: "Paste", icon: <Clipboard size={16} /> },
    { id: "upload", label: "Upload File", mobileLabel: "Upload", icon: <Upload size={16} /> },
    { id: "write", label: "Write Here", mobileLabel: "Write", icon: <Edit2 size={16} /> },
  ];

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* --- Top Navbar --- */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-border bg-background/50 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">New Document</h1>
            <div className="flex items-center gap-1.5 lg:hidden mt-0.5">
               <div className="w-1 h-1 rounded-full bg-primary" />
               <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate max-w-[100px]">
                 {activeProfile?.name || "..."}
               </span>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-2 ml-4">
             <div className="h-4 w-px bg-border" />
             <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/10 text-secondary border border-secondary/20">
               <Briefcase size={12} />
               <span className="text-[10px] font-bold uppercase tracking-wider">{activeProfile?.name}</span>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Desktop Controls */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Analysis Type</span>
              <Select
                className="w-[140px] h-9"
                value={contentType}
                onChange={(e) => {
                  setContentType(e.target.value as ContentType);
                  setIsManualType(true);
                  setDetectionState("manual");
                }}
                options={CONTENT_TYPES}
              />
            </div>
            <div className="flex items-center gap-2 pl-2 border-l border-border/50">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Brand Profile</span>
              <Select
                className="w-[160px] h-9"
                value={activeProfileId}
                onChange={(e) => setActiveProfileId(e.target.value)}
                options={profiles.map(p => ({ value: p.id, label: p.name }))}
              />
            </div>
          </div>
          
          {/* Mobile Settings Toggle */}
          <button 
            onClick={() => setShowMobileSettings(true)}
            className="lg:hidden p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* --- Mobile Content Type Bar --- */}
      <div className="lg:hidden h-14 border-b border-border bg-card flex items-center overflow-x-auto no-scrollbar px-4 gap-2">
        {MOBILE_CONTENT_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => {
              setContentType(type.value);
              setIsManualType(true);
              setDetectionState("manual");
            }}
            className={cn(
              "whitespace-nowrap h-9 px-4 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all",
              contentType === type.value
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-background text-muted-foreground border border-border"
            )}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* --- Main Workspace --- */}
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        <Tabs 
          tabs={tabs} 
          activeTab={activeTab} 
          onChange={setActiveTab} 
          className="bg-card/30 border-b border-border px-6" 
        />

        <div className="flex-1 flex flex-col min-h-0 relative">
          {activeTab === "paste" && (
            <div className="flex-1 flex flex-col">
              <div className="h-10 bg-muted/30 border-b border-border flex items-center justify-between px-6">
                <div className="flex items-center gap-6">
                  <button 
                    className="text-[11px] font-bold text-muted-foreground hover:text-primary flex items-center gap-1.5 transition-colors"
                    onClick={async () => {
                      const text = await navigator.clipboard.readText().catch(() => "");
                      if (text) setContent(text);
                    }}
                  >
                    <Clipboard size={12} /> Paste
                  </button>
                  <button 
                    className="text-[11px] font-bold text-muted-foreground hover:text-accent flex items-center gap-1.5 transition-colors" 
                    onClick={clearContent}
                  >
                    <Trash2 size={12} /> Clear
                  </button>
                </div>
                <div className="flex items-center gap-2">
                   {detectionState === "detected" && (
                     <span className="flex items-center gap-1 text-[10px] font-bold text-primary animate-in fade-in slide-in-from-right-2">
                       <Sparkles size={10} /> Auto-detected
                     </span>
                   )}
                   <span className="text-[11px] font-bold text-muted-foreground px-2 py-0.5 rounded-md bg-muted">
                    {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
                   </span>
                </div>
              </div>
              <textarea
                id="paste-textarea"
                className="flex-1 w-full p-8 lg:p-12 resize-none focus:outline-none bg-transparent text-lg lg:text-xl font-medium leading-relaxed placeholder:text-muted-foreground/30 selection:bg-primary/20"
                placeholder="Paste your AI content here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          )}

          {activeTab === "upload" && (
            <div 
              className="flex-1 p-6 lg:p-12 flex flex-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFileUpload(file);
              }}
            >
              <div className={cn(
                "flex-1 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-center p-8 transition-all duration-300",
                isParsing ? "bg-muted/50 border-primary" : "bg-muted/20 border-border hover:border-primary/50 hover:bg-muted/30"
              )}>
                {isParsing ? (
                  <div className="w-full max-w-sm space-y-6">
                    <div className="relative w-16 h-16 mx-auto">
                       <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                       <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold">Reading document...</h3>
                      <p className="text-sm text-muted-foreground">Analysing structure and extracting text</p>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-md space-y-6">
                    <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto text-primary">
                      <Upload size={32} strokeWidth={2.5} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold tracking-tight">Drop any document</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed px-8">
                        Drag and drop your file here, or browse. We support <strong>DOCX</strong>, <strong>PDF</strong>, and <strong>TXT</strong>.
                      </p>
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
                      variant="primary" 
                      size="lg"
                      className="px-10 rounded-full shadow-lg shadow-primary/20"
                      onClick={() => document.getElementById("file-upload")?.click()}
                    >
                      Browse Files
                    </Button>
                    
                    {parseError && (
                      <div className="p-4 rounded-2xl bg-accent/5 border border-accent/20 text-accent text-sm font-medium animate-in zoom-in-95">
                        {parseError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "write" && (
            <div className="flex-1 flex flex-col">
              <input
                type="text"
                placeholder="Document Title (Optional)"
                className="h-16 px-12 border-b border-border bg-transparent text-xl font-bold placeholder:text-muted-foreground/30 focus:outline-none"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <div className="h-12 bg-muted/10 border-b border-border flex items-center px-10 gap-1 overflow-x-auto no-scrollbar">
                 <button className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted text-sm font-bold">B</button>
                 <button className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted text-sm italic font-serif">I</button>
                 <div className="h-4 w-px bg-border mx-2" />
                 <button className="h-8 px-3 flex items-center justify-center rounded-lg hover:bg-muted text-xs font-bold uppercase tracking-wider">H1</button>
                 <button className="h-8 px-3 flex items-center justify-center rounded-lg hover:bg-muted text-xs font-bold uppercase tracking-wider">H2</button>
              </div>
              <textarea
                className="flex-1 w-full p-12 resize-none focus:outline-none bg-transparent text-lg lg:text-xl font-medium leading-relaxed placeholder:text-muted-foreground/30"
                placeholder="Start typing your masterpiece..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* --- Footer Status & Action --- */}
      <div className="px-6 py-4 border-t border-border bg-card/50 flex items-center justify-between z-20">
        <div className="flex items-center gap-6">
           <div className="hidden sm:flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                detectionState === 'auto' ? "bg-border" : "bg-primary animate-pulse"
              )} />
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-2 py-0.5 rounded-md bg-muted/50">
                {detectionState === "manual" ? `Set: ${contentType}` : 
                 detectionState === "detected" ? `Detected: ${contentType}` : 
                 "System: Auto-detect"}
              </span>
           </div>
           
           {/* Progress indicators for long/short text */}
           <div className="flex items-center gap-3">
             {wordCount > 0 && wordCount < 50 && (
               <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent/5 border border-accent/20 text-[10px] font-bold text-accent animate-in fade-in slide-in-from-left-2 transition-all">
                 <AlertCircle size={12} /> MIN. 50 WORDS RECOMMENDED
               </div>
             )}
             {wordCount > 3000 && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/20 text-[10px] font-bold text-primary animate-in fade-in slide-in-from-left-2 transition-all">
                  <AlertCircle size={12} /> LONG CONTENT
                </div>
             )}
           </div>
        </div>

        <Button
          variant="brand"
          size="lg"
          className="rounded-full px-10 shadow-2xl shadow-primary/20 font-bold tracking-tight"
          disabled={isAnalysing || (activeTab === "paste" && !content.trim())}
          onClick={handleAnalyse}
          loading={isAnalysing}
        >
          {isAnalysing ? "Analysing..." : "Analyse Content"}
        </Button>
      </div>

      {/* --- Mobile Settings Sheet --- */}
      {showMobileSettings && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
           <div 
             className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" 
             onClick={() => setShowMobileSettings(false)}
           />
           <div className="relative bg-card rounded-t-[40px] px-8 pt-4 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-300">
              <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-8 cursor-grab active:cursor-grabbing" />
              
              <div className="flex items-center justify-between mb-10">
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold tracking-tight text-foreground">Configuration</h3>
                  <p className="text-sm text-muted-foreground">Tailor the analysis engine</p>
                </div>
                <button 
                  onClick={() => setShowMobileSettings(false)} 
                  className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-border transition-colors outline-none"
                >
                   <X size={20} />
                </button>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Analysis Type</label>
                  <Select
                    value={contentType}
                    onChange={(e) => {
                      setContentType(e.target.value as ContentType);
                      setIsManualType(true);
                      setDetectionState("manual");
                    }}
                    options={CONTENT_TYPES}
                    className="h-14 text-base font-bold rounded-2xl"
                  />
                </div>
                
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Brand Identity</label>
                  <Select
                    value={activeProfileId}
                    onChange={(e) => setActiveProfileId(e.target.value)}
                    options={profiles.map(p => ({ value: p.id, label: p.name }))}
                    className="h-14 text-base font-bold rounded-2xl"
                  />
                </div>

                <Button 
                  variant="primary"
                  className="w-full mt-4 h-16 text-lg font-bold rounded-3xl shadow-xl shadow-primary/20"
                  onClick={() => setShowMobileSettings(false)}
                >
                  Confirm Settings
                </Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
