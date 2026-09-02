"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"

interface ChatMessage {
  role: "user" | "assistant"
  text: string
  toolSummaries?: string[]
}

interface AgentToolCall {
  toolName: string
  status: "executed" | "blocked" | "approval_required" | "error"
  output?: unknown
  reason?: string
  error?: string
}

function summarizeToolCall(call: AgentToolCall): string {
  if (call.status === "blocked") return `Blocked by policy: ${call.toolName} (${call.reason ?? "not allowed"})`
  if (call.status === "approval_required") return `Needs your approval in the Approvals inbox: ${call.toolName}`
  if (call.status === "error") return `${call.toolName} failed: ${call.error ?? "unknown error"}`
  return `Ran ${call.toolName}`
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Ask me about revenue, opportunities, or draft a campaign proposal. I can never approve a campaign or issue a refund myself - those always come back to you.",
    },
  ])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, open])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setInput("")
    setMessages((prev) => [...prev, { role: "user", text }])
    setSending(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: `Sorry, something went wrong: ${data?.message ?? res.statusText}` },
        ])
        return
      }

      const toolCalls: AgentToolCall[] = data.tool_calls ?? []
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.reply || "(no reply)", toolSummaries: toolCalls.map(summarizeToolCall) },
      ])

      if (toolCalls.some((c) => c.toolName === "create_campaign_proposal")) router.refresh()
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Sorry, I couldn't reach Mercury right now." }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {open && (
        <div className="mb-3 flex h-[28rem] w-[22rem] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border bg-brand px-4 py-3 text-brand-foreground">
            <p className="text-sm font-semibold">Merchant Assistant</p>
            <button onClick={() => setOpen(false)} className="text-sm opacity-80 hover:opacity-100">
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div key={index} className={message.role === "user" ? "text-right" : "text-left"}>
                <div
                  className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    message.role === "user" ? "bg-brand text-brand-foreground" : "bg-brand-soft text-foreground"
                  }`}
                >
                  {message.text}
                </div>
                {message.toolSummaries && message.toolSummaries.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-muted">
                    {message.toolSummaries.map((summary, i) => (
                      <li key={i}>• {summary}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {sending && <p className="text-xs text-muted">Thinking...</p>}
          </div>

          <div className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send()
              }}
              placeholder="Ask about revenue, opportunities..."
              className="flex-1 rounded-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button
              onClick={send}
              disabled={sending}
              className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground shadow-lg transition hover:opacity-90"
      >
        {open ? "Close" : "Ask Merchant AI"}
      </button>
    </div>
  )
}
