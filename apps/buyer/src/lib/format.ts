export function formatInr(amount: number | null | undefined): string {
  const value = Math.round(Number(amount ?? 0))
  return `₹${value.toLocaleString("en-IN")}`
}
