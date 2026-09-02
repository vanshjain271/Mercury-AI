import { redirect } from "next/navigation"
import { getToken } from "@/lib/session"
import { Sidebar } from "@/components/sidebar"
import { ChatWidget } from "@/components/chat-widget"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const token = await getToken()
  if (!token) redirect("/login")

  return (
    <div className="flex">
      <Sidebar />
      <main className="min-h-screen flex-1 overflow-x-hidden">{children}</main>
      <ChatWidget />
    </div>
  )
}
