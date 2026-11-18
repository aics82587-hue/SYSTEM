"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { ProfileIdentity } from "@/components/ProfileIdentity";
import { Avatar } from "@/components/Avatar";
import type { AppRole } from "@/lib/identity";

interface FreedomWallPost {
  id: string;
  author_id: string;
  content: string;
  sticky_color: string;
  paper_texture: "plain" | "lined" | "dotted" | "kraft" | "grid";
  font_family: "handwriting" | "print" | "script";
  pos_x: number;
  pos_y: number;
  is_visible: boolean;
  created_at: string;
  profiles?: {
    public_name: string;
    role: string;
    position?: string;
    avatar_id?: string;
  };
}

const PRESET_COLORS = [
  { label: "Yellow", hex: "#FEF08A" },
  { label: "Pink", hex: "#FBCFE8" },
  { label: "Mint", hex: "#BBF7D0" },
  { label: "Sky Blue", hex: "#BAE6FD" },
  { label: "Lavender", hex: "#DDD6FE" },
  { label: "Peach", hex: "#FED7AA" },
  { label: "Warm Lemon", hex: "#FDE047" },
  { label: "Rose", hex: "#FECDD3" },
];

const TEXTURES = [
  { id: "plain", label: "Plain" },
  { id: "lined", label: "Lined" },
  { id: "dotted", label: "Dotted" },
  { id: "grid", label: "Grid" },
  { id: "kraft", label: "Kraft" },
] as const;

const FONTS = [
  { id: "handwriting", label: "Handwriting", fontName: "'Caveat', cursive, sans-serif" },
  { id: "print", label: "Print", fontName: "'Inter', sans-serif" },
  { id: "script", label: "Script", fontName: "'Dancing Script', cursive, sans-serif" },
] as const;

export default function FreedomWallPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<AppRole>("student");
  const [currentUserNickname, setCurrentUserNickname] = useState<string>("");
  const [currentAvatarId, setCurrentAvatarId] = useState("lavender-cat");
  const [posts, setPosts] = useState<FreedomWallPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].hex);
  const [selectedTexture, setSelectedTexture] = useState<FreedomWallPost["paper_texture"]>("plain");
  const [selectedFont, setSelectedFont] = useState<FreedomWallPost["font_family"]>("handwriting");
  const [isSaving, setIsSaving] = useState(false);

  // Dragging State
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [draggingPostId, setDraggingPostId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragCurrentPos, setDragCurrentPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // 1. Auth check and initial posts fetch
  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadWall() {
      try {
        setIsLoading(true);
        setErrorMsg(null);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("id, public_name, role, position, avatar_id")
          .eq("id", user.id)
          .single();

        if (!profile) {
          router.push("/login");
          return;
        }

        if (!isMounted) return;
        setCurrentUserId(user.id);
        setCurrentUserRole(profile.role as AppRole);
        setCurrentUserNickname(profile.public_name);
        setCurrentAvatarId(profile.avatar_id);

        // Fetch visible freedom wall posts
        const { data: postsData, error: postsErr } = await supabase
          .from("freedom_wall_posts")
          .select(
            `
            id,
            author_id,
            content,
            sticky_color,
            paper_texture,
            font_family,
            pos_x,
            pos_y,
            is_visible,
            created_at,
            profiles:author_id (public_name, role, position, avatar_id)
          `
          )
          .eq("is_visible", true)
          .order("created_at", { ascending: true });

        if (postsErr) throw postsErr;

        if (!isMounted) return;
        const mapped: FreedomWallPost[] = (postsData || []).map((p) => ({
          ...p,
          profiles: p.profiles as unknown as { public_name: string; role: string; position?: string; avatar_id?: string } | undefined,
        }));
        setPosts(mapped);

        // Setup realtime subscription
        channel = supabase
          .channel("freedom_wall_realtime")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "freedom_wall_posts" },
            (payload) => {
              if (payload.eventType === "INSERT") {
                const newRow = payload.new as FreedomWallPost;
                if (newRow.is_visible) {
                  setPosts((prev) => {
                    if (prev.some((p) => p.id === newRow.id)) return prev;
                    return [...prev, newRow];
                  });
                }
              } else if (payload.eventType === "UPDATE") {
                const updatedRow = payload.new as FreedomWallPost;
                setPosts((prev) =>
                  updatedRow.is_visible
                    ? prev.map((p) => (p.id === updatedRow.id ? { ...p, ...updatedRow } : p))
                    : prev.filter((p) => p.id !== updatedRow.id)
                );
              } else if (payload.eventType === "DELETE") {
                const oldRow = payload.old as { id: string };
                setPosts((prev) => prev.filter((p) => p.id !== oldRow.id));
              }
            }
          )
          .subscribe();
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Failed to load freedom wall";
          setErrorMsg(msg);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadWall();

    return () => {
      isMounted = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router, supabase]);

  // Texture style generator
  const getTextureStyle = (texture: FreedomWallPost["paper_texture"]): React.CSSProperties => {
    switch (texture) {
      case "lined":
        return {
          backgroundImage: "repeating-linear-gradient(transparent, transparent 23px, rgba(0, 0, 0, 0.09) 24px)",
          backgroundSize: "100% 24px",
        };
      case "dotted":
        return {
          backgroundImage: "radial-gradient(rgba(0, 0, 0, 0.14) 1.5px, transparent 1.5px)",
          backgroundSize: "16px 16px",
        };
      case "grid":
        return {
          backgroundImage:
            "linear-gradient(rgba(0, 0, 0, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.08) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        };
      case "kraft":
        return {
          backgroundImage:
            "radial-gradient(circle, rgba(139, 92, 44, 0.08) 1px, transparent 1px), linear-gradient(135deg, rgba(0,0,0,0.03), rgba(0,0,0,0.08))",
          backgroundSize: "6px 6px, 100% 100%",
        };
      case "plain":
      default:
        return {};
    }
  };

  const getFontFamily = (font: FreedomWallPost["font_family"]) => {
    switch (font) {
      case "handwriting":
        return "'Caveat', cursive, sans-serif";
      case "script":
        return "'Dancing Script', cursive, sans-serif";
      case "print":
      default:
        return "'Inter', sans-serif";
    }
  };

  const getFontSize = (font: FreedomWallPost["font_family"]) => {
    switch (font) {
      case "handwriting":
        return "1.25rem";
      case "script":
        return "1.15rem";
      case "print":
      default:
        return "0.95rem";
    }
  };

  // Dragging logic
  const handleMouseDown = (e: React.PointerEvent, post: FreedomWallPost) => {
    // Only author or counselor can move notes
    const canMove = post.author_id === currentUserId || currentUserRole === "counselor";
    if (!canMove) return;

    if (!boardRef.current) return;
    const boardRect = boardRef.current.getBoundingClientRect();

    const mouseX = e.clientX - boardRect.left;
    const mouseY = e.clientY - boardRect.top;

    setDraggingPostId(post.id);
    setDragOffset({
      x: mouseX - post.pos_x,
      y: mouseY - post.pos_y,
    });
    setDragCurrentPos({
      x: post.pos_x,
      y: post.pos_y,
    });

    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingPostId || !boardRef.current) return;

    const boardRect = boardRef.current.getBoundingClientRect();
    const currentX = e.clientX - boardRect.left;
    const currentY = e.clientY - boardRect.top;

    let newX = Math.round(currentX - dragOffset.x);
    let newY = Math.round(currentY - dragOffset.y);

    // Keep within bounds
    const maxX = Math.max(0, boardRect.width - 230);
    const maxY = Math.max(0, boardRect.height - 220);

    newX = Math.max(10, Math.min(newX, maxX));
    newY = Math.max(10, Math.min(newY, maxY));

    setDragCurrentPos({ x: newX, y: newY });
  };

  const handlePointerUp = async (e: React.PointerEvent) => {
    if (!draggingPostId) return;

    const targetPostId = draggingPostId;
    const finalPos = { ...dragCurrentPos };

    setDraggingPostId(null);

    // Update local state immediately
    setPosts((prev) =>
      prev.map((p) => (p.id === targetPostId ? { ...p, pos_x: finalPos.x, pos_y: finalPos.y } : p))
    );

    // Save to database
    try {
      await supabase
        .from("freedom_wall_posts")
        .update({
          pos_x: finalPos.x,
          pos_y: finalPos.y,
        })
        .eq("id", targetPostId);
    } catch (err) {
      console.error("Failed to save post position:", err);
    }
  };

  // Add / Edit Modal Controls
  const handleOpenAdd = () => {
    setEditingPostId(null);
    setContent("");
    setSelectedColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].hex);
    setSelectedTexture("plain");
    setSelectedFont("handwriting");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (post: FreedomWallPost) => {
    setEditingPostId(post.id);
    setContent(post.content);
    setSelectedColor(post.sticky_color);
    setSelectedTexture(post.paper_texture);
    setSelectedFont(post.font_family);
    setIsModalOpen(true);
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Are you sure you want to remove this sticky note?")) return;

    try {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      const { error } = await supabase.from("freedom_wall_posts").delete().eq("id", postId);
      if (error) throw error;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete post";
      alert(msg);
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;

    const trimmed = content.trim();
    if (!trimmed) return;

    try {
      setIsSaving(true);

      if (editingPostId) {
        // Update existing post
        const { error } = await supabase
          .from("freedom_wall_posts")
          .update({
            content: trimmed,
            sticky_color: selectedColor,
            paper_texture: selectedTexture,
            font_family: selectedFont,
          })
          .eq("id", editingPostId);

        if (error) throw error;

        setPosts((prev) =>
          prev.map((p) =>
            p.id === editingPostId
              ? {
                  ...p,
                  content: trimmed,
                  sticky_color: selectedColor,
                  paper_texture: selectedTexture,
                  font_family: selectedFont,
                }
              : p
          )
        );
      } else {
        // Create new post with calculated initial position
        const boardWidth = boardRef.current ? boardRef.current.clientWidth : 800;
        const boardHeight = boardRef.current ? boardRef.current.clientHeight : 700;

        const randomX = Math.floor(Math.random() * Math.max(100, boardWidth - 280)) + 30;
        const randomY = Math.floor(Math.random() * Math.max(100, boardHeight - 260)) + 40;

        const { data: newRow, error } = await supabase
          .from("freedom_wall_posts")
          .insert({
            author_id: currentUserId,
            content: trimmed,
            sticky_color: selectedColor,
            paper_texture: selectedTexture,
            font_family: selectedFont,
            pos_x: randomX,
            pos_y: randomY,
            is_visible: true,
          })
          .select("*, profiles:author_id(public_name, role, position, avatar_id)")
          .single();

        if (error) throw error;

        if (newRow) {
          const mappedNewRow: FreedomWallPost = {
            ...newRow,
            profiles: newRow.profiles as unknown as { public_name: string; role: string; position?: string; avatar_id?: string } | undefined,
          };
          setPosts((prev) => [...prev, mappedNewRow]);
        }
      }

      setIsModalOpen(false);
      setContent("");
      setEditingPostId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to post note";
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Inline Google Fonts for Handwriting and Script */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Dancing+Script:wght@600;700&display=swap');

        @keyframes notePopIn {
          0% {
            transform: scale(0.4) rotate(-6deg);
            opacity: 0;
          }
          75% {
            transform: scale(1.06) rotate(1deg);
            opacity: 1;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }

        .sticky-note {
          animation: notePopIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s ease;
          touch-action: none;
          user-select: none;
        }

        .sticky-note:hover {
          transform: translateY(-5px) rotate(1deg) scale(1.02);
          box-shadow: 6px 14px 28px rgba(0, 0, 0, 0.45) !important;
          z-index: 50 !important;
        }

        .sticky-note.dragging {
          transform: scale(1.06) rotate(3deg) !important;
          box-shadow: 8px 20px 34px rgba(0, 0, 0, 0.55) !important;
          z-index: 100 !important;
          cursor: grabbing !important;
        }

        .sticky-note .note-actions {
          opacity: 0;
          transition: opacity 0.15s ease;
        }

        .sticky-note:hover .note-actions {
          opacity: 1;
        }

        .corner-fold {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 0 20px 20px;
          border-color: transparent transparent rgba(0, 0, 0, 0.15) transparent;
          pointer-events: none;
        }
      `}</style>

      <Navbar role={currentUserRole} nickname={currentUserNickname} avatarId={currentAvatarId} />
      <div className="dashboard-layout">
        <Sidebar role={currentUserRole} nickname={currentUserNickname} avatarId={currentAvatarId} />
        <main className="dashboard-main" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Section Header */}
          <div className="section-header">
            <div>
              <h1 className="section-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span title="Community Board" role="img" aria-hidden="true">
                  📌
                </span>
                Community Board
              </h1>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                A safe, expressive bulletin board. Share thoughts, words of cheer, or feelings with the community.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span className="badge badge-muted" style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}>
                🖐️ Drag notes anywhere to rearrange
              </span>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="btn btn-primary btn-sm"
                title="Post a note on the Community Board"
                aria-label="Add note to freedom wall"
              >
                <span title="Add pin" role="img" aria-hidden="true">
                  ➕
                </span>
                Post a Note
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="notice notice-danger" role="alert">
              {errorMsg}
            </div>
          )}

          {/* Corkboard Bulletin Board */}
          <div
            ref={boardRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
              position: "relative",
              minHeight: "740px",
              width: "100%",
              borderRadius: "var(--radius-lg)",
              border: "10px solid #352110",
              boxShadow: "inset 0 0 50px rgba(0, 0, 0, 0.75), 0 8px 30px rgba(0, 0, 0, 0.5)",
              // Corkboard textured background
              backgroundColor: "#29190c",
              backgroundImage: `
                radial-gradient(circle at 50% 50%, rgba(45, 28, 14, 0.7), rgba(20, 12, 6, 0.95)),
                linear-gradient(45deg, #382412 25%, transparent 25%),
                linear-gradient(-45deg, #382412 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #382412 75%),
                linear-gradient(-45deg, transparent 75%, #382412 75%)
              `,
              backgroundSize: "100% 100%, 24px 24px, 24px 24px, 24px 24px, 24px 24px",
              overflow: "hidden",
            }}
            role="region"
            aria-label="Freedom wall board canvas"
          >
            {isLoading ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: "0.75rem",
                  color: "#e8d8c3",
                }}
              >
                <div className="spinner" style={{ borderTopColor: "#e8d8c3" }} />
                <p style={{ fontSize: "0.95rem" }}>Pinning sticky notes...</p>
              </div>
            ) : posts.length === 0 ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: "1rem",
                  color: "#d0beaa",
                  textAlign: "center",
                  padding: "2rem",
                }}
              >
                <span style={{ fontSize: "3rem" }} title="Corkboard pushpin">
                  📌
                </span>
                <h3 style={{ color: "#f7eee3", fontWeight: 600 }}>The board is fresh and quiet</h3>
                <p style={{ maxWidth: "420px", fontSize: "0.9rem", color: "#bfaaa0" }}>
                  Be the first to post a sticky note! Share kindness, relief, or an encouraging quote with your peers.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="btn btn-primary btn-sm"
                  title="Post the first sticky note"
                >
                  Post First Note
                </button>
              </div>
            ) : (
              posts.map((post) => {
                const isDragging = draggingPostId === post.id;
                const isAuthor = post.author_id === currentUserId;
                const canManage = isAuthor || currentUserRole === "counselor";

                const posX = isDragging ? dragCurrentPos.x : post.pos_x;
                const posY = isDragging ? dragCurrentPos.y : post.pos_y;

                return (
                  <div
                    key={post.id}
                    className={`sticky-note ${isDragging ? "dragging" : ""}`}
                    onPointerDown={(e) => handleMouseDown(e, post)}
                    style={{
                      position: "absolute",
                      left: `${posX}px`,
                      top: `${posY}px`,
                      width: "230px",
                      minHeight: "190px",
                      padding: "1.2rem 1.1rem 1rem",
                      backgroundColor: post.sticky_color,
                      color: "#18181b",
                      borderRadius: "3px",
                      boxShadow: "2px 8px 18px rgba(0, 0, 0, 0.35), 0 2px 4px rgba(0, 0, 0, 0.2)",
                      cursor: canManage ? (isDragging ? "grabbing" : "grab") : "default",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      fontFamily: getFontFamily(post.font_family),
                      fontSize: getFontSize(post.font_family),
                      lineHeight: post.font_family === "print" ? 1.5 : 1.35,
                      ...getTextureStyle(post.paper_texture),
                    }}
                    role="article"
                    aria-label={`Sticky note: ${post.content.slice(0, 30)}...`}
                  >
                    {/* Pushpin at top center */}
                    <div
                      style={{
                        position: "absolute",
                        top: "-8px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "1.1rem",
                        filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.4))",
                        pointerEvents: "none",
                      }}
                      title="Pin"
                    >
                      📌
                    </div>

                    {/* Corner fold effect */}
                    <div className="corner-fold" />

                    {/* Content */}
                    <div
                      style={{
                        wordBreak: "break-word",
                        whiteSpace: "pre-wrap",
                        flex: 1,
                        marginBottom: "0.75rem",
                      }}
                    >
                      {post.content}
                    </div>

                    {/* Footer: Date & Hover Actions */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "0.72rem",
                        fontFamily: "'Inter', sans-serif",
                        color: "rgba(0,0,0,0.55)",
                        borderTop: "1px dashed rgba(0,0,0,0.15)",
                        paddingTop: "0.35rem",
                      }}
                    >
                      <div className="wall-post-author">
                        <Avatar
                          name={post.profiles?.role === "counselor" ? post.profiles.public_name : undefined}
                          avatarId={post.profiles?.avatar_id}
                          anonymous={post.profiles?.role !== "counselor"}
                          size="small"
                        />
                        {post.profiles?.role === "counselor" ? (
                          <span className="wall-counselor-name">
                            <ProfileIdentity name={post.profiles.public_name} role="counselor" position={post.profiles.position} />
                          </span>
                        ) : (
                          <span className="sr-only">Anonymous community member</span>
                        )}
                        <span>
                          {new Date(post.created_at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>

                      {/* Edit / Delete Buttons on Hover (for Author or Counselor) */}
                      {canManage && (
                        <div
                          className="note-actions"
                          style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
                          onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking buttons
                        >
                          {isAuthor && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(post)}
                              className="btn btn-ghost btn-sm"
                              title="Edit note"
                              aria-label="Edit note"
                              style={{
                                padding: "0.15rem 0.35rem",
                                fontSize: "0.72rem",
                                color: "#333",
                                background: "rgba(255,255,255,0.4)",
                                borderRadius: "4px",
                              }}
                            >
                              ✏️
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeletePost(post.id)}
                            className="btn btn-ghost btn-sm"
                            title="Delete note"
                            aria-label="Delete note"
                            style={{
                              padding: "0.15rem 0.35rem",
                              fontSize: "0.72rem",
                              color: "#b91c1c",
                              background: "rgba(255,255,255,0.4)",
                              borderRadius: "4px",
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Add / Edit Note Modal */}
          {isModalOpen && (
            <div
              className="modal-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="note-modal-title"
              style={{ zIndex: 300 }}
            >
              <div
                className="modal"
                style={{
                  maxWidth: "580px",
                  width: "95%",
                  maxHeight: "90vh",
                  overflowY: "auto",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h2 id="note-modal-title" className="modal-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span title="Sticky note" role="img" aria-hidden="true">
                      📌
                    </span>
                    {editingPostId ? "Edit Sticky Note" : "Post a New Sticky Note"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="btn btn-ghost btn-sm"
                    title="Close"
                    aria-label="Close modal"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveNote} aria-label="Freedom wall note form">
                  {/* Content Textarea */}
                  <div className="form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label htmlFor="note-content-input" className="form-label">
                        Note Message *
                      </label>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: content.length >= 260 ? "var(--warning)" : "var(--text-muted)",
                        }}
                      >
                        {content.length} / 280
                      </span>
                    </div>
                    <textarea
                      id="note-content-input"
                      className="form-textarea"
                      placeholder="Write your thought, feeling, or encouraging words here..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      maxLength={280}
                      rows={4}
                      required
                      disabled={isSaving}
                      style={{ fontSize: "1rem" }}
                      aria-label="Sticky note message content"
                    />
                  </div>

                  {/* Color Picker: 8 preset pastel colors */}
                  <div className="form-group">
                    <label className="form-label">Sticky Paper Color</label>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.6rem",
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                      role="radiogroup"
                      aria-label="Select sticky note color"
                    >
                      {PRESET_COLORS.map((c) => {
                        const isChosen = selectedColor === c.hex;
                        return (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setSelectedColor(c.hex)}
                            title={c.label}
                            aria-label={`Color ${c.label}`}
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              backgroundColor: c.hex,
                              border: isChosen ? "3px solid var(--brand)" : "2px solid rgba(255,255,255,0.2)",
                              boxShadow: isChosen ? "0 0 10px rgba(var(--brand-rgb), 0.35)" : "none",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "transform 0.15s ease",
                              transform: isChosen ? "scale(1.15)" : "scale(1)",
                            }}
                          >
                            {isChosen && (
                              <span style={{ color: "#333", fontSize: "0.9rem", fontWeight: 700 }}>
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Texture Picker */}
                  <div className="form-group">
                    <label className="form-label">Paper Texture</label>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
                        gap: "0.5rem",
                      }}
                      role="radiogroup"
                      aria-label="Select paper texture"
                    >
                      {TEXTURES.map((t) => {
                        const isChosen = selectedTexture === t.id;
                        return (
                          <label
                            key={t.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "0.5rem 0.6rem",
                              borderRadius: "var(--radius-sm)",
                              border: isChosen ? "2px solid var(--brand)" : "1px solid var(--border-light)",
                              background: isChosen ? "rgba(var(--brand-rgb), 0.15)" : "var(--bg-elevated)",
                              color: isChosen ? "var(--brand-light)" : "var(--text-secondary)",
                              cursor: "pointer",
                              fontSize: "0.85rem",
                              fontWeight: 500,
                              textAlign: "center",
                            }}
                          >
                            <input
                              type="radio"
                              name="texture"
                              value={t.id}
                              checked={isChosen}
                              onChange={() => setSelectedTexture(t.id)}
                              style={{ display: "none" }}
                              aria-label={`Texture ${t.label}`}
                            />
                            {t.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Font Picker */}
                  <div className="form-group">
                    <label className="form-label">Handwriting Font Style</label>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: "0.5rem",
                      }}
                      role="radiogroup"
                      aria-label="Select handwriting font"
                    >
                      {FONTS.map((f) => {
                        const isChosen = selectedFont === f.id;
                        return (
                          <label
                            key={f.id}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "0.2rem",
                              padding: "0.6rem 0.75rem",
                              borderRadius: "var(--radius-sm)",
                              border: isChosen ? "2px solid var(--brand)" : "1px solid var(--border-light)",
                              background: isChosen ? "rgba(var(--brand-rgb), 0.15)" : "var(--bg-elevated)",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="radio"
                              name="font"
                              value={f.id}
                              checked={isChosen}
                              onChange={() => setSelectedFont(f.id)}
                              style={{ display: "none" }}
                              aria-label={`Font ${f.label}`}
                            />
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{f.label}</span>
                            <span
                              style={{
                                fontFamily: f.fontName,
                                fontSize: "1.2rem",
                                color: isChosen ? "var(--brand-light)" : "var(--text-primary)",
                              }}
                            >
                              Sample Note
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Live Note Preview */}
                  <div className="form-group">
                    <label className="form-label">Live Preview</label>
                    <div
                      style={{
                        padding: "1.2rem",
                        backgroundColor: selectedColor,
                        color: "#18181b",
                        borderRadius: "3px",
                        boxShadow: "2px 6px 14px rgba(0,0,0,0.25)",
                        fontFamily: getFontFamily(selectedFont),
                        fontSize: getFontSize(selectedFont),
                        lineHeight: selectedFont === "print" ? 1.5 : 1.35,
                        minHeight: "110px",
                        wordBreak: "break-word",
                        position: "relative",
                        ...getTextureStyle(selectedTexture),
                      }}
                    >
                      <div className="corner-fold" />
                      {content.trim() ? content : <span style={{ opacity: 0.5 }}>Type above to see your note preview here...</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsModalOpen(false)}
                      disabled={isSaving}
                      title="Cancel note editing"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isSaving || !content.trim()}
                      title={editingPostId ? "Update note" : "Pin note to board"}
                    >
                      {isSaving ? (
                        <>
                          <div className="spinner" style={{ width: "16px", height: "16px" }} />
                          Posting...
                        </>
                      ) : editingPostId ? (
                        "Save Changes"
                      ) : (
                        "📌 Pin to Board"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
