import { ToolDefinition } from "./types"
import {
  searchProductsTool,
  getProductTool,
  compareProductsTool,
  getInventoryTool,
} from "./tools/catalog-tools"
import {
  addToCartTool,
  createPaymentSessionTool,
  completeOrderTool,
  getOrderTool,
  getPaymentStatusTool,
} from "./tools/commerce-tools"
import {
  analyzeRevenueTool,
  findOpportunitiesTool,
  createCampaignProposalTool,
  approveCampaignTool,
  refundPaymentTool,
} from "./tools/merchant-tools"

const BUYER_TOOLS: ToolDefinition[] = [
  searchProductsTool,
  getProductTool,
  compareProductsTool,
  getInventoryTool,
  addToCartTool,
  createPaymentSessionTool,
  completeOrderTool,
  getOrderTool,
  getPaymentStatusTool,
]

const MERCHANT_TOOLS: ToolDefinition[] = [
  analyzeRevenueTool,
  findOpportunitiesTool,
  createCampaignProposalTool,
  approveCampaignTool,
  refundPaymentTool,
  // Merchant agent can also inspect the catalog when reasoning about
  // growth ideas (e.g. "which headphones should I bundle").
  searchProductsTool,
  getProductTool,
  getInventoryTool,
]

const ALL_TOOLS = new Map<string, ToolDefinition>()
for (const tool of [...BUYER_TOOLS, ...MERCHANT_TOOLS]) {
  ALL_TOOLS.set(tool.name, tool)
}

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return ALL_TOOLS.get(name)
}

export function getToolsForAgent(agentType: "buyer" | "merchant"): ToolDefinition[] {
  return agentType === "buyer" ? BUYER_TOOLS : MERCHANT_TOOLS
}

export function toAnthropicToolSpec(tool: ToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }
}
