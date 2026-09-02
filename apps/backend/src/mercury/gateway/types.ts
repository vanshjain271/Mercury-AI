import { MedusaContainer } from "@medusajs/framework/types"

export interface ToolContext {
  container: MedusaContainer
  sessionId: string
  agentType: "buyer" | "merchant"
  /** Customer id for the buyer agent, admin/user id for the merchant agent. */
  actorId?: string | null
}

export interface ToolDefinition<TInput = any, TOutput = any> {
  name: string
  description: string
  /** JSON Schema for the tool's input, sent to the model as part of tool-use. */
  inputSchema: Record<string, unknown>
  /**
   * Resolves the amount (in whole INR rupees) this specific call would
   * move, if any - used by the policy engine before execute() runs. Async
   * because the amount for money-moving tools (e.g. create_payment_session)
   * is the cart's current server-side total, not something the caller can
   * be trusted to state. Return undefined for tools that never move money.
   */
  amountInr?: (input: TInput, ctx: ToolContext) => Promise<number | undefined> | number | undefined
  execute: (input: TInput, ctx: ToolContext) => Promise<TOutput>
}

export interface ToolCallRequest {
  toolName: string
  input: Record<string, unknown>
}

export type ToolCallStatus =
  | "executed"
  | "blocked"
  | "approval_required"
  | "error"

export interface ToolCallResult {
  toolName: string
  status: ToolCallStatus
  /** Present when status is "executed". */
  output?: unknown
  /** Present when status is "blocked" or "approval_required". */
  reason?: string
  /** Present when status is "approval_required". */
  approvalRequestId?: string
  /** Present when status is "error". */
  error?: string
}
