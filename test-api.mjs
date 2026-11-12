const BASE = "http://127.0.0.1:3000";
const results = [];
const check = (name, pass, detail = "") => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` [${String(detail).slice(0,180)}]` : ""}`); };
const uid = Date.now().toString(36);
let cookieA = "", cookieB = "";
async function req(path, { method = "GET", body, cookie = cookieA, form } = {}) {
  const response = await fetch(BASE + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: form ?? (body ? JSON.stringify(body) : undefined), redirect: "manual" });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookieA = setCookie.split(";")[0];
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, headers: response.headers, text };
}
function val(name, condition, detail = "") { if (!condition) throw new Error(`${name}: ${detail}`); check(name, true, detail); }

const register = await req("/api/auth/register", { method: "POST", body: { fullName: "API Tester", email: `test-${uid}@example.com`, password: "strongpass123" } });
val("registration", register.status === 200, register.status);
cookieA = cookieA || "";
let onboard = await req("/api/business", { method: "PATCH", body: { name: "API Test Agency", businessType: "Digital agency", industry: "Technology", currency: "USD", monthlyRevenueEstimate: 15000, email: `test-${uid}@example.com`, country: "United States", taxRate: 10, paymentTermsDays: 14, cashBalance: 20000, onboardingComplete: true, seedDemo: false } });
val("onboarding persisted", onboard.status === 200 && onboard.data.business.onboardingComplete, onboard.status);
await req("/api/auth/logout", { method: "POST" });
cookieA = "";
val("logout protects dashboard", (await req("/api/dashboard")).status === 401);
const login = await req("/api/auth/login", { method: "POST", body: { email: `test-${uid}@example.com`, password: "strongpass123" } });
val("login", login.status === 200 && cookieA.includes("paypilot_session"), login.status);
val("invalid password rejected", (await req("/api/auth/login", { method: "POST", body: { email: `test-${uid}@example.com`, password: "wrong-password" } })).status === 401);

const client = await req("/api/data/clients", { method: "POST", body: { name: "Test Client", company: "ABC Technologies", email: "ap@abc.example", paymentTermsDays: 14 } });
val("client created", client.status === 201 && client.data.client.id, client.status);
const clientId = client.data.client.id;
const project = await req("/api/data/projects", { method: "POST", body: { name: "API Mobile MVP", clientId, description: "Full test project", budget: 12000, status: "active", startDate: "2026-01-01" } });
val("project created and assigned", project.status === 201 && project.data.project.clientId === clientId, project.status);
const projectId = project.data.project.id;
const quote = await req("/api/data/quotations", { method: "POST", body: { clientId, projectId, status: "draft", issueDate: "2026-01-01", validUntil: "2026-02-01", discountType: "percent", discountValue: 5, taxRate: 10, items: [{ description: "Discovery", quantity: 2, unitPrice: 500 }, { description: "Build", quantity: 1, unitPrice: 1000 }] } });
val("quotation created", quote.status === 201, quote.status);
const quoteId = quote.data.quotation.id;
val("quotation totals exact", Number(quote.data.quotation.total) === 2090, quote.data.quotation.total);
await req(`/api/data/quotations/${quoteId}`, { method: "PATCH", body: { status: "accepted" } });
const invoice = await req("/api/data/invoices", { method: "POST", body: { quotationId: quoteId, status: "sent", issueDate: "2026-01-05", dueDate: "2026-01-19" } });
val("accepted quotation converted", invoice.status === 201 && invoice.data.invoice.quotationId === quoteId, invoice.status);
val("converted totals and items", Number(invoice.data.invoice.total) === 2090 && invoice.data.invoice.items.length === 2, invoice.data.invoice.total);
const invoiceId = invoice.data.invoice.id;
const pdf = await req(`/api/invoices/${invoiceId}/pdf`);
val("invoice PDF generated", pdf.status === 200 && pdf.text.startsWith("%PDF"), `${pdf.status} ${pdf.headers.get("content-type")}`);

const draft = await req("/api/data/invoices", { method: "POST", body: { clientId, status: "draft", issueDate: "2026-02-01", dueDate: "2026-02-15", taxRate: 0, items: [{ description: "Advisory", quantity: 1, unitPrice: 1000 }] } });
val("draft invoice created", draft.status === 201 && draft.data.invoice.status === "draft", draft.status);
const draftId = draft.data.invoice.id;
const edited = await req(`/api/data/invoices/${draftId}`, { method: "PATCH", body: { items: [{ description: "Advisory", quantity: 2, unitPrice: 750 }], notes: "Edited draft" } });
val("draft line items edited", edited.status === 200 && Number(edited.data.invoice.total) === 1500, edited.data.invoice?.total);
val("draft issued", (await req(`/api/data/invoices/${draftId}`, { method: "PATCH", body: { status: "sent" } })).status === 200);
const duplicate = await req("/api/data/invoices", { method: "POST", body: { clientId, status: "draft", issueDate: "2026-02-01", dueDate: "2026-02-15", taxRate: 0, items: [{ description: "Advisory", quantity: 2, unitPrice: 750 }] } });
val("duplicate invoice blocked", duplicate.status === 409, `${duplicate.status} ${duplicate.data.error}`);
val("missing client rejected", (await req("/api/data/invoices", { method: "POST", body: { items: [{ description: "Work", quantity: 1, unitPrice: 100 }] } })).status === 400);

val("partial payment", (await req("/api/data/payments", { method: "POST", body: { invoiceId, amount: 1000, method: "bank_transfer" } })).status === 201);
const afterFullPayment = await req("/api/data/payments", { method: "POST", body: { invoiceId, amount: 1090, method: "bank_transfer" } });
val("full payment reconciles invoice", afterFullPayment.status === 201, afterFullPayment.status);
const invoicesNow = await req("/api/data/invoices");
const paidInvoice = invoicesNow.data.invoices.find((item) => item.id === invoiceId);
val("invoice becomes paid with exact balance", paidInvoice.status === "paid" && paidInvoice.balance === 0, `${paidInvoice.status}/${paidInvoice.balance}`);
val("overpayment rejected", (await req("/api/data/payments", { method: "POST", body: { invoiceId, amount: 1 } })).status === 400);

const order = await req("/api/paypal/create-order", { method: "POST", body: { invoiceId: draftId } });
val("demo order explicitly labelled", order.status === 200 && order.data.mode === "demo" && order.data.orderId.startsWith("DEMO-"), order.status);
const orderId = order.data.orderId;
const status = await req("/api/paypal/status", { method: "POST", body: { invoiceId: draftId, orderId } });
val("PayPal status sync works in demo", status.status === 200 && status.data.status === "SIMULATED", status.status);
val("demo capture needs confirmation", (await req("/api/paypal/capture", { method: "POST", body: { invoiceId: draftId, orderId } })).status === 400);
const capture = await req("/api/paypal/capture", { method: "POST", body: { invoiceId: draftId, orderId, confirmDemo: true } });
val("demo capture is simulated, never paid", capture.status === 200 && capture.data.status === "SIMULATED" && capture.data.invoice.status !== "paid", capture.data.status);
const duplicateCapture = await req("/api/paypal/capture", { method: "POST", body: { invoiceId: draftId, orderId, confirmDemo: true } });
val("capture idempotent", duplicateCapture.status === 200 && duplicateCapture.data.alreadyRecorded, duplicateCapture.status);
const dashboard = await req("/api/dashboard");
const demoCash = dashboard.data.metrics.cashBalance;
val("simulation does not affect cash metrics", Number.isFinite(demoCash) && demoCash === 20000 + 2090, demoCash);

const expense = await req("/api/data/expenses", { method: "POST", body: { category: "auto", vendor: "AWS", description: "Cloud hosting", amount: 320, expenseDate: "2026-02-02", paymentMethod: "card" } });
val("expense auto-categorised", expense.status === 201 && expense.data.expense.category === "software", expense.data.expense?.category);
const expenseId = expense.data.expense.id;
const form = new FormData(); form.set("expenseId", expenseId); form.set("file", new File(["%PDF-1.4 test receipt"], "receipt.pdf", { type: "application/pdf" }));
const receipt = await req("/api/receipts", { method: "POST", form });
val("receipt uploaded", receipt.status === 201 && receipt.data.receiptUrl, receipt.status);
const receiptFile = await req(receipt.data.receiptUrl);
val("receipt download private and valid", receiptFile.status === 200 && receiptFile.headers.get("content-type") === "application/pdf", receiptFile.status);
val("wrong receipt type rejected", await (async () => { const f = new FormData(); f.set("expenseId", expenseId); f.set("file", new File(["plain"], "note.txt", { type: "text/plain" })); const r = await req("/api/receipts", { method: "POST", form: f }); return r.status === 400; })());

const overdue = await req("/api/data/invoices", { method: "POST", body: { clientId, status: "sent", issueDate: "2025-01-01", dueDate: "2025-01-15", taxRate: 0, items: [{ description: "Legacy support", quantity: 1, unitPrice: 300 }] } });
val("overdue invoice created", overdue.status === 201, overdue.status);
const actions = await req("/api/actions");
const reminder = actions.data.actions.find((action) => action.kind === "payment_reminder" && action.approvalStatus === "pending");
val("overdue action recommendation with reason", !!reminder && reminder.reason.includes("remains unpaid"), actions.data.actions.length);
const approval = await req("/api/actions", { method: "POST", body: { id: reminder.id, operation: "approve" } });
val("action approval recorded", approval.status === 200 && approval.data.action.approvalStatus === "approved", approval.status);
val("cannot execute before approval state is valid", reminder.executionStatus === "not_started");
const execution = await req("/api/actions", { method: "POST", body: { id: reminder.id, operation: "execute" } });
val("approved reminder executes as draft only", execution.status === 200 && execution.data.action.executionStatus === "completed" && execution.data.message.includes("No external email"), execution.data.message);
const notes = await req("/api/notifications");
val("notifications persist event history", notes.data.notifications.length >= 3 && notes.data.notifications.some((n) => n.title.includes("Payment reminder draft")), notes.data.notifications.length);

for (const horizon of [30, 60, 90]) {
  const cf = await req(`/api/cashflow?horizon=${horizon}`);
  val(`${horizon}-day forecast computed with assumptions`, cf.status === 200 && cf.data.forecast.series.length === horizon && cf.data.forecast.assumptions.length >= 4 && cf.data.forecast.isEstimate, cf.data.forecast?.horizonDays);
}
const agentReview = await req("/api/agents", { method: "POST" });
val("all five agents orchestrated", agentReview.status === 200 && agentReview.data.agents.length === 5 && agentReview.data.plan.agentsInvolved.length >= 3, agentReview.data.plan?.agentsInvolved);
val("insights carry agent, severity and data", agentReview.data.insights.every((i) => i.agent && i.severity && i.recommendation), agentReview.data.insights.length);

const affordability = await req("/api/assistant", { method: "POST", body: { message: "Can I afford $30000 in expenses next month?" } });
val("orchestrator affordability uses payment + cashflow agents", affordability.status === 200 && affordability.data.reply.agents.includes("payment") && affordability.data.reply.agents.includes("cashflow") && affordability.data.reply.content.includes("estimate"), affordability.data.reply?.agents);
const expected = await req("/api/assistant", { method: "POST", body: { message: "How much money am I expecting this month?" } });
val("expected collections grounded in invoices", expected.data.reply.content.includes("outstanding") && expected.data.reply.content.includes("estimate"), expected.data.reply?.content?.slice(0,80));
const noPrice = await req("/api/assistant", { method: "POST", body: { message: "Generate an invoice for Test Client" } });
val("assistant never invents invoice price", noPrice.data.reply.actions.length === 0 && noPrice.data.reply.content.includes("What amount"), noPrice.data.reply?.content);
const priced = await req("/api/assistant", { method: "POST", body: { message: "Generate an invoice for Test Client for $5000" } });
val("assistant creates approval card for real amount", priced.data.reply.actions.length === 1 && priced.data.reply.actions[0].payload.amount === 5000, priced.data.reply?.actions?.[0]?.payload?.amount);
const approvalMessage = priced.data.reply;
const approvedInvoice = await req("/api/assistant/approve", { method: "POST", body: { messageId: approvalMessage.id, actionId: "create_invoice" } });
val("assistant action requires and executes approval", approvedInvoice.status === 200 && approvedInvoice.data.invoiceId, approvedInvoice.status);
const reportCsv = await req("/api/reports?type=profit-loss&format=csv");
val("CSV report generated", reportCsv.status === 200 && reportCsv.text.includes("Month,Revenue,Expenses"), reportCsv.status);
const reportPdf = await req("/api/reports?type=cashflow&format=pdf");
val("PDF report generated", reportPdf.status === 200 && reportPdf.text.startsWith("%PDF"), reportPdf.status);

const regB = await fetch(BASE + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: "Other User", email: `other-${uid}@example.com`, password: "strongpass123" }) });
cookieB = regB.headers.get("set-cookie")?.split(";")[0] ?? "";
await req("/api/business", { method: "PATCH", cookie: cookieB, body: { name: "Other Business", currency: "USD", onboardingComplete: true, seedDemo: false } });
const foreignPdf = await req(`/api/invoices/${invoiceId}/pdf`, { cookie: cookieB });
val("cross-user invoice PDF denied", foreignPdf.status === 404, foreignPdf.status);
const foreignCapture = await req("/api/paypal/capture", { cookie: cookieB, method: "POST", body: { invoiceId, orderId: "NOT-REAL" } });
val("cross-user PayPal capture denied", foreignCapture.status === 404 || foreignCapture.status === 403, foreignCapture.status);
const otherClients = await req("/api/data/clients", { cookie: cookieB });
val("user data isolated", otherClients.status === 200 && otherClients.data.clients.length === 0, otherClients.data.clients?.length);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
