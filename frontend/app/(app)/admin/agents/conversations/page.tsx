"use client";
import { useEffect, useState } from "react";
import {
  getAgentConversations, getAgentConversation,
  type AgentConversation, type AgentMessage,
  MSG_TYPE_COLOR, MSG_TYPE_LABEL, relativeTime,
} from "@/lib/agents-api";

function TypeBadge({ type }: { type: string }) {
  const color = MSG_TYPE_COLOR[type] || "var(--text-3)";
  const label = MSG_TYPE_LABEL[type] || type;
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99,
      background: `${color}14`, color, border: `1px solid ${color}30`,
    }}>
      {label}
    </span>
  );
}

function SenderAvatar({ name, type }: { name: string; type: string }) {
  const colors: Record<string, string> = {
    agent: "var(--brand-600)", system: "var(--text-3)",
    admin: "var(--green)", user: "var(--amber)",
  };
  const bg = colors[type] || "var(--text-3)";
  return (
    <div style={{
      width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
      background: `${bg}18`, color: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 700, border: `1.5px solid ${bg}30`,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function MessageBubble({ msg }: { msg: AgentMessage }) {
  const isSystem = msg.sender_type === "system";
  return (
    <div style={{
      display: "flex", gap: 12, alignItems: "flex-start",
      opacity: isSystem ? 0.65 : 1,
    }}>
      <SenderAvatar name={msg.sender_name} type={msg.sender_type} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>
            {msg.sender_name}
          </span>
          <TypeBadge type={msg.message_type} />
          <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>
            {new Date(msg.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
        <div style={{
          background: "var(--bg-subtle)", border: "1px solid var(--line)",
          borderRadius: "4px 12px 12px 12px", padding: "10px 14px",
          fontSize: 13, color: "var(--text-1)", lineHeight: 1.65,
        }}>
          {msg.content}
        </div>
      </div>
    </div>
  );
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [selected,      setSelected]      = useState<AgentConversation | null>(null);
  const [messages,      setMessages]      = useState<AgentMessage[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLoading(true);
    getAgentConversations(50)
      .then((r) => { setConversations(r.conversations); setLoading(false); })
      .catch((e) => { setErr(e.message); setLoading(false); });
  }, []);

  async function selectConv(c: AgentConversation) {
    setSelected(c);
    setDetailLoading(true);
    try {
      const detail = await getAgentConversation(c.id);
      setMessages(detail.messages || []);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>Admin → AI Agents</span>
          <span style={{ color: "var(--text-3)" }}>→</span>
          <span style={{ fontSize: 11, color: "var(--brand-600)", fontWeight: 500 }}>Konuşmalar</span>
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 400, margin: "0 0 4px" }}>
          Agent Konuşmaları
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
          {conversations.length} konuşma — ajan diyaloglarını incele
        </p>
      </div>

      {err && (
        <div style={{ padding: "10px 14px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {err}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, height: "calc(100vh - 220px)", minHeight: 500 }}>
        {/* Konuşma listesi */}
        <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)", fontSize: 13, fontWeight: 500 }}>
            Konuşmalar
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Yükleniyor…</div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>◑</div>
                <div style={{ fontSize: 13, color: "var(--text-3)" }}>Henüz konuşma yok.</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 6 }}>
                  Center sayfasından Mock Run başlatın.
                </div>
              </div>
            ) : (
              conversations.map((c) => {
                const active = selected?.id === c.id;
                return (
                  <button key={c.id} onClick={() => selectConv(c)} style={{
                    width: "100%", textAlign: "left", padding: "14px 16px",
                    borderBottom: "1px solid var(--line)", cursor: "pointer",
                    background: active ? "var(--green-bg)" : "transparent",
                    border: "none", borderLeft: active ? "3px solid var(--brand-600)" : "3px solid transparent",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: active ? "var(--brand-700)" : "var(--text-1)", marginBottom: 4, lineHeight: 1.4 }}>
                      {c.title}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "var(--text-3)", background: "var(--bg-subtle)", padding: "1px 6px", borderRadius: 99 }}>
                        {c.source}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                        {relativeTime(c.created_at)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Timeline görünümü */}
        <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {!selected ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <div style={{ fontSize: 40, opacity: 0.25 }}>◑</div>
              <div style={{ fontSize: 14, color: "var(--text-3)" }}>Sol taraftan bir konuşma seçin</div>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-1)", marginBottom: 4 }}>
                  {selected.title}
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-3)" }}>
                  <span>Kaynak: {selected.source}</span>
                  <span>·</span>
                  <span>{messages.length} mesaj</span>
                  <span>·</span>
                  <span>{new Date(selected.created_at).toLocaleString("tr-TR")}</span>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
                {detailLoading ? (
                  <div style={{ textAlign: "center", padding: 32, color: "var(--text-3)" }}>Mesajlar yükleniyor…</div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 32, color: "var(--text-3)" }}>Bu konuşmada mesaj yok.</div>
                ) : (
                  messages.map((msg, i) => (
                    <div key={msg.id}>
                      {/* Zaman bölücü — her 3 mesajda bir */}
                      {i > 0 && i % 5 === 0 && (
                        <div style={{
                          display: "flex", alignItems: "center", gap: 12, margin: "8px 0 20px",
                        }}>
                          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                          <span style={{ fontSize: 10, color: "var(--text-3)", whiteSpace: "nowrap" }}>
                            {new Date(msg.created_at).toLocaleTimeString("tr-TR")}
                          </span>
                          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                        </div>
                      )}
                      <MessageBubble msg={msg} />
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
