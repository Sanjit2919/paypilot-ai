import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const money = (name: string) => numeric(name, { precision: 16, scale: 2 });

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResets = pgTable("password_resets", {
  token: text("token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull().default(""),
    businessType: text("business_type").notNull().default("agency"),
    industry: text("industry").notNull().default("technology"),
    currency: text("currency").notNull().default("USD"),
    monthlyRevenueEstimate: money("monthly_revenue_estimate").notNull().default("0"),
    email: text("email").notNull().default(""),
    country: text("country").notNull().default("United States"),
    taxRate: money("tax_rate").notNull().default("0"),
    paymentTermsDays: integer("payment_terms_days").notNull().default(14),
    cashBalance: money("cash_balance").notNull().default("0"),
    onboardingComplete: boolean("onboarding_complete").notNull().default(false),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("businesses_user_unique").on(t.userId)],
);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    company: text("company").notNull().default(""),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    country: text("country").notNull().default(""),
    address: text("address").notNull().default(""),
    paymentTermsDays: integer("payment_terms_days").notNull().default(14),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("clients_user_idx").on(t.userId)],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("active"),
    budget: money("budget").notNull().default("0"),
    startDate: text("start_date").notNull().default(""),
    endDate: text("end_date").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("projects_user_idx").on(t.userId)],
);

export const quotations = pgTable(
  "quotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    number: text("number").notNull(),
    status: text("status").notNull().default("draft"),
    issueDate: text("issue_date").notNull(),
    validUntil: text("valid_until").notNull().default(""),
    subtotal: money("subtotal").notNull().default("0"),
    discountType: text("discount_type").notNull().default("percent"),
    discountValue: money("discount_value").notNull().default("0"),
    taxRate: money("tax_rate").notNull().default("0"),
    total: money("total").notNull().default("0"),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quotations_user_idx").on(t.userId), uniqueIndex("quotations_user_number_unique").on(t.userId, t.number)],
);

export const quotationItems = pgTable(
  "quotation_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quotationId: uuid("quotation_id")
      .notNull()
      .references(() => quotations.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull().default("1"),
    unitPrice: money("unit_price").notNull().default("0"),
    amount: money("amount").notNull().default("0"),
  },
  (t) => [index("quotation_items_quotation_idx").on(t.quotationId)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    quotationId: uuid("quotation_id").references(() => quotations.id, { onDelete: "set null" }),
    number: text("number").notNull(),
    status: text("status").notNull().default("draft"),
    issueDate: text("issue_date").notNull(),
    dueDate: text("due_date").notNull(),
    subtotal: money("subtotal").notNull().default("0"),
    discountType: text("discount_type").notNull().default("percent"),
    discountValue: money("discount_value").notNull().default("0"),
    taxRate: money("tax_rate").notNull().default("0"),
    total: money("total").notNull().default("0"),
    amountPaid: money("amount_paid").notNull().default("0"),
    notes: text("notes").notNull().default(""),
    paypalOrderId: text("paypal_order_id"),
    shareToken: text("share_token"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invoices_user_idx").on(t.userId), uniqueIndex("invoices_user_number_unique").on(t.userId, t.number), uniqueIndex("invoices_share_token_unique").on(t.shareToken)],
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull().default("1"),
    unitPrice: money("unit_price").notNull().default("0"),
    amount: money("amount").notNull().default("0"),
  },
  (t) => [index("invoice_items_invoice_idx").on(t.invoiceId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    amount: money("amount").notNull().default("0"),
    method: text("method").notNull().default("bank_transfer"),
    status: text("status").notNull().default("completed"),
    transactionId: text("transaction_id"),
    paypalOrderId: text("paypal_order_id"),
    note: text("note").notNull().default(""),
    paidAt: text("paid_at").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_user_idx").on(t.userId), uniqueIndex("payments_paypal_order_unique").on(t.paypalOrderId)],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    category: text("category").notNull().default("software"),
    vendor: text("vendor").notNull().default(""),
    description: text("description").notNull().default(""),
    amount: money("amount").notNull().default("0"),
    taxAmount: money("tax_amount").notNull().default("0"),
    paymentMethod: text("payment_method").notNull().default("card"),
    expenseDate: text("expense_date").notNull(),
    receiptUrl: text("receipt_url").notNull().default(""),
    isRecurring: boolean("is_recurring").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("expenses_user_idx").on(t.userId)],
);

export const receiptAttachments = pgTable(
  "receipt_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    contentBase64: text("content_base64").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("receipt_attachments_expense_idx").on(t.expenseId), index("receipt_attachments_user_idx").on(t.userId)],
);

export const cashFlowForecasts = pgTable("cash_flow_forecasts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  horizonDays: integer("horizon_days").notNull(),
  startingBalance: money("starting_balance").notNull().default("0"),
  projectedBalance: money("projected_balance").notNull().default("0"),
  assumptions: jsonb("assumptions").$type<string[]>().notNull().default([]),
  series: jsonb("series").$type<{ date: string; balance: number; inflow: number; outflow: number }[]>()
    .notNull()
    .default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiInsights = pgTable(
  "ai_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agent: text("agent").notNull(),
    severity: text("severity").notNull().default("info"),
    title: text("title").notNull(),
    explanation: text("explanation").notNull(),
    supportingData: jsonb("supporting_data").$type<Record<string, unknown>>().notNull().default({}),
    recommendation: text("recommendation").notNull().default(""),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_insights_user_idx").on(t.userId)],
);

export const agentActivities = pgTable(
  "agent_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agent: text("agent").notNull(),
    action: text("action").notNull(),
    status: text("status").notNull().default("info"),
    detail: text("detail").notNull().default(""),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("agent_activities_user_idx").on(t.userId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    type: text("type").notNull().default("info"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);

export const financialActions = pgTable(
  "financial_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dedupeKey: text("dedupe_key").notNull(),
    agent: text("agent").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    reason: text("reason").notNull(),
    expectedOutcome: text("expected_outcome").notNull(),
    supportingData: jsonb("supporting_data").$type<Record<string, unknown>>().notNull().default({}),
    approvalStatus: text("approval_status").notNull().default("pending"),
    executionStatus: text("execution_status").notNull().default("not_started"),
    resultMessage: text("result_message").notNull().default(""),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("financial_actions_user_idx").on(t.userId), uniqueIndex("financial_actions_dedupe_unique").on(t.userId, t.dedupeKey)],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    agents: jsonb("agents").$type<string[]>().notNull().default([]),
    actions: jsonb("actions")
      .$type<{ id: string; label: string; kind: string; payload: Record<string, unknown> }[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chat_messages_user_idx").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Quotation = typeof quotations.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type AiInsight = typeof aiInsights.$inferSelect;
export type AgentActivity = typeof agentActivities.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type FinancialAction = typeof financialActions.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
