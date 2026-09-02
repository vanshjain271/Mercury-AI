export function formatInr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "-"
  return `₹${Math.round(Number(amount)).toLocaleString("en-IN")}`
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}
