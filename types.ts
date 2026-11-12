export type AgentKey = "invoice" | "payment" | "expense" | "cashflow" | "bi" | "coordinator";
export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type BusinessDTO = {
  id: string;
  name: string;
  businessType: string;
  industry: string;
  currency: string;
  monthlyRevenueEstimate: number;
  email: string;
  country: string;
  taxRate: number;
  paymentTermsDays: number;
  cashBalance: number;
  onboardingComplete: boolean;
  isDemo: boolean;
};

export type LineItemDTO = {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type ClientDTO = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  country: string;
  address: string;
  paymentTermsDays: number;
  notes: string;
  createdAt: string;
};

export type ProjectDTO = {
  id: string;
  clientId: string | null;
  clientName: string;
  name: string;
  description: string;
  status: string;
  budget: number;
  startDate: string;
  endDate: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  invoiced: number;
  outstanding: number;
  paid: number;
};

export type InvoiceDTO = {
  id: string;
  number: string;
  clientId: string | null;
  clientName: string;
  projectId: string | null;
  projectName: string;
  quotationId: string | null;
  status: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  discountType: string;
  discountValue: number;
  taxRate: number;
  total: number;
  amountPaid: number;
  balance: number;
  notes: string;
  items: LineItemDTO[];
  createdAt: string;
};

export type QuotationDTO = {
  id: string;
  number: string;
  clientId: string | null;
  clientName: string;
  projectId: string | null;
  projectName: string;
  status: string;
  issueDate: string;
  validUntil: string;
  subtotal: number;
  discountType: string;
  discountValue: number;
  taxRate: number;
  total: number;
  notes: string;
  items: LineItemDTO[];
  createdAt: string;
};

export type PaymentDTO = {
  id: string;
  invoiceId: string | null;
  invoiceNumber: string;
  clientId: string | null;
  clientName: string;
  amount: number;
  method: string;
  status: string;
  transactionId: string;
  note: string;
  paidAt: string;
  createdAt: string;
};

export type ExpenseDTO = {
  id: string;
  projectId: string | null;
  projectName: string;
  category: string;
  vendor: string;
  description: string;
  amount: number;
  taxAmount: number;
  paymentMethod: string;
  expenseDate: string;
  receiptUrl: string;
  isRecurring: boolean;
  createdAt: string;
};

export type InsightDTO = {
  id: string;
  agent: string;
  severity: Severity;
  title: string;
  explanation: string;
  supportingData: Record<string, unknown>;
  recommendation: string;
  status: string;
  createdAt: string;
};

export type ActivityDTO = {
  id: string;
  agent: string;
  action: string;
  status: string;
  detail: string;
  createdAt: string;
};

export type NotificationDTO = {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
};

export type Metrics = {
  totalRevenue: number;
  pendingPayments: number;
  totalExpenses: number;
  netProfit: number;
  outstandingInvoices: number;
  outstandingAmount: number;
  overdueAmount: number;
  overdueCount: number;
  upcomingInflow: number;
  upcomingOutflow: number;
  cashBalance: number;
  openingBalance: number;
  invoicedTotal: number;
  collectedTotal: number;
  expenseThisMonth: number;
  expenseLastMonth: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  profitMargin: number;
  collectionRate: number;
  avgDaysToPay: number;
  runwayDays: number;
  draftInvoices: number;
  paidInvoices: number;
  totalInvoices: number;
  activeProjects: number;
  totalClients: number;
  recurringMonthlyExpense: number;
};

export type ForecastPoint = {
  date: string;
  balance: number;
  inflow: number;
  outflow: number;
};

export type Forecast = {
  horizonDays: number;
  startingBalance: number;
  projectedBalance: number;
  lowestBalance: number;
  lowestDate: string;
  shortageDate: string | null;
  expectedInflow: number;
  expectedOutflow: number;
  series: ForecastPoint[];
  assumptions: string[];
  confidence: number;
  isEstimate: true;
};

export type HealthFactor = { label: string; score: number; weight: number; detail: string };

export type Health = {
  score: number;
  grade: string;
  factors: HealthFactor[];
  headline: string;
};

export type MonthlyPoint = { month: string; label: string; revenue: number; expenses: number; profit: number };

export type ClientProfile = ClientDTO & {
  invoiced: number;
  paid: number;
  outstanding: number;
  overdue: number;
  invoiceCount: number;
  onTimeRate: number;
  avgDaysToPay: number;
  lastPaymentAt: string | null;
  riskLevel: "low" | "medium" | "high";
};

export type DashboardPayload = {
  business: BusinessDTO;
  metrics: Metrics;
  monthly: MonthlyPoint[];
  forecast: Forecast;
  health: Health;
  summary: string;
  insights: InsightDTO[];
  activities: ActivityDTO[];
  notifications: NotificationDTO[];
  recentTransactions: {
    id: string;
    kind: "payment" | "expense";
    label: string;
    party: string;
    amount: number;
    date: string;
    status: string;
  }[];
  pendingInvoices: InvoiceDTO[];
  upcoming: { id: string; label: string; amount: number; date: string; kind: "inflow" | "outflow" }[];
  expenseBreakdown: { category: string; amount: number; share: number }[];
  revenueByClient: { client: string; amount: number }[];
};

export type AgentActionCard = {
  id: string;
  label: string;
  kind: string;
  payload: Record<string, unknown>;
  requiresApproval: boolean;
};

export type AssistantReply = {
  reply: string;
  agents: string[];
  actions: AgentActionCard[];
  data?: Record<string, unknown>;
  escalated?: boolean;
};
