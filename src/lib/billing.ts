/**
 * Billing & Invoicing — consultation invoices, payment tracking.
 * Razorpay integration is code-ready; requires merchant credentials.
 */
import crypto from "crypto";
import { getDb } from "./db";
import type { BillingRecord } from "./db";
import { auditLog } from "./audit";

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const d = getDb();
  const count = (d.prepare("SELECT COUNT(*) as c FROM billing_records WHERE invoice_number LIKE ?").get(`INV-${year}%`) as { c: number }).c;
  return `INV-${year}-${String(count + 1).padStart(5, "0")}`;
}

export function listBilling(filter: {
  hospital_id?: string;
  patient_id?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): BillingRecord[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.hospital_id) { clauses.push("hospital_id = ?"); params.push(filter.hospital_id); }
  if (filter.patient_id) { clauses.push("patient_id = ?"); params.push(filter.patient_id); }
  if (filter.status) { clauses.push("status = ?"); params.push(filter.status); }
  if (filter.search) {
    clauses.push("(invoice_number LIKE ? OR patient_name LIKE ? OR patient_mobile LIKE ?)");
    const q = `%${filter.search}%`; params.push(q, q, q);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;
  return getDb().prepare(`SELECT * FROM billing_records ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params as any[], limit, offset) as unknown as BillingRecord[];
}

export function getBilling(id: string): BillingRecord | null {
  return (getDb().prepare("SELECT * FROM billing_records WHERE id = ?").get(id) as unknown as unknown as BillingRecord) || null;
}

export function getBillingByInvoice(invoiceNumber: string): BillingRecord | null {
  return (getDb().prepare("SELECT * FROM billing_records WHERE invoice_number = ?").get(invoiceNumber) as unknown as unknown as BillingRecord) || null;
}

export function getBillingByAppointment(appointmentId: string): BillingRecord | null {
  return (getDb().prepare("SELECT * FROM billing_records WHERE appointment_id = ?").get(appointmentId) as unknown as unknown as BillingRecord) || null;
}

export interface CreateBillingInput {
  appointment_id?: string | null;
  hospital_id?: string | null;
  patient_id?: string | null;
  patient_name: string;
  patient_mobile: string;
  patient_email?: string | null;
  items: Array<{ name: string; description?: string; quantity: number; unit_price: number; amount: number }>;
  tax_rate?: number; // percentage
  discount_amount?: number;
  due_date?: string | null;
  created_by?: string | null;
}

export function createBilling(input: CreateBillingInput, actor?: string): BillingRecord {
  const id = genId("bill");
  const invoice_number = generateInvoiceNumber();
  const now = new Date().toISOString();

  const subtotal = input.items.reduce((s, it) => s + it.amount, 0);
  const tax_amount = input.tax_rate ? Math.round(subtotal * input.tax_rate / 100) : 0;
  const discount = input.discount_amount ?? 0;
  const total = subtotal + tax_amount - discount;

  getDb().prepare(`
    INSERT INTO billing_records (id, invoice_number, appointment_id, hospital_id, patient_id, patient_name, patient_mobile, patient_email, items, subtotal, tax_amount, discount_amount, total_amount, paid_amount, status, due_date, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?, ?, ?)
  `).run(
    id, invoice_number, input.appointment_id ?? null, input.hospital_id ?? "hosp_default",
    input.patient_id ?? null, input.patient_name, input.patient_mobile, input.patient_email ?? null,
    JSON.stringify(input.items), subtotal, tax_amount, discount, total,
    input.due_date ?? null, input.created_by ?? actor ?? null, now, now
  );

  if (actor) auditLog(actor, "billing.created", "billing", id, `${invoice_number} total=${total}`);
  return getBilling(id)!;
}

export function updateBillingStatus(id: string, status: string, opts: { paid_amount?: number; payment_method?: string; payment_reference?: string; actor?: string } = {}): BillingRecord {
  const bill = getBilling(id);
  if (!bill) throw new Error("Billing record not found.");
  const fields: string[] = ["status = ?"];
  const vals: unknown[] = [status];
  if (opts.paid_amount !== undefined) { fields.push("paid_amount = ?"); vals.push(opts.paid_amount); }
  if (opts.payment_method) { fields.push("payment_method = ?"); vals.push(opts.payment_method); }
  if (opts.payment_reference) { fields.push("payment_reference = ?"); vals.push(opts.payment_reference); }
  if (status === "paid") { fields.push("paid_at = ?"); vals.push(new Date().toISOString()); }
  fields.push("updated_at = ?"); vals.push(new Date().toISOString());
  vals.push(id);
  getDb().prepare(`UPDATE billing_records SET ${fields.join(", ")} WHERE id = ?`).run(...(vals as any[]));
  if (opts.actor) auditLog(opts.actor, `billing.${status}`, "billing", id);
  return getBilling(id)!;
}

export function getBillingStats(hospitalId?: string): { total: number; pending: number; paid: number; totalRevenue: number; pendingAmount: number } {
  const d = getDb();
  const where = hospitalId ? "WHERE hospital_id = ?" : "";
  const params = hospitalId ? [hospitalId] : [];
  const total = (d.prepare(`SELECT COUNT(*) as c FROM billing_records ${where}`).get(...params as any[]) as { c: number }).c;
  const pending = (d.prepare(`SELECT COUNT(*) as c FROM billing_records ${where ? where + " AND" : "WHERE"} status = 'pending'`).get(...params as any[]) as { c: number }).c;
  const paid = (d.prepare(`SELECT COUNT(*) as c FROM billing_records ${where ? where + " AND" : "WHERE"} status = 'paid'`).get(...params as any[]) as { c: number }).c;
  const rev = (d.prepare(`SELECT COALESCE(SUM(total_amount),0) as s FROM billing_records ${where ? where + " AND" : "WHERE"} status = 'paid'`).get(...params as any[]) as { s: number }).s;
  const pendAmt = (d.prepare(`SELECT COALESCE(SUM(total_amount),0) as s FROM billing_records ${where ? where + " AND" : "WHERE"} status = 'pending'`).get(...params as any[]) as { s: number }).s;
  return { total, pending, paid, totalRevenue: rev, pendingAmount: pendAmt };
}

// ---- Razorpay helpers (code-ready, needs credentials) ----

export interface RazorpayOrderInput {
  billing_id: string;
  amount: number; // in INR
  currency?: string;
  receipt?: string;
}

export function isRazorpayConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export async function createRazorpayOrder(input: RazorpayOrderInput): Promise<{ ok: boolean; order?: { id: string; amount: number; currency: string }; error?: string }> {
  if (!isRazorpayConfigured()) {
    return { ok: false, error: "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET." };
  }
  try {
    const Razorpay = (await import("razorpay")).default;
    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
    const order = await instance.orders.create({
      amount: Math.round(input.amount * 100), // paise
      currency: input.currency ?? "INR",
      receipt: input.receipt ?? `rcpt_${Date.now()}`,
    });
    // Save order id to billing + payment_transactions
    const bill = getBilling(input.billing_id);
    if (bill) {
      getDb().prepare("UPDATE billing_records SET razorpay_order_id = ?, updated_at = ? WHERE id = ?").run(order.id, new Date().toISOString(), input.billing_id);
      const payId = genId("pay");
      const now = new Date().toISOString();
      getDb().prepare(`INSERT INTO payment_transactions (id, billing_id, razorpay_order_id, amount, currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'created', ?, ?)`)
        .run(payId, input.billing_id, order.id, input.amount, input.currency ?? "INR", now, now);
    }
    return { ok: true, order: { id: order.id, amount: Number(order.amount), currency: order.currency } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function verifyRazorpayPayment(params: { order_id: string; payment_id: string; signature: string }): { ok: boolean; error?: string } {
  if (!process.env.RAZORPAY_KEY_SECRET) return { ok: false, error: "Razorpay secret not configured." };
  try {
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${params.order_id}|${params.payment_id}`);
    const expected = hmac.digest("hex");
    // timing-safe compare
    if (expected.length !== params.signature.length) return { ok: false, error: "Invalid signature length." };
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ params.signature.charCodeAt(i);
    return { ok: diff === 0 };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function handleRazorpayWebhook(payload: { order_id: string; payment_id: string; signature: string; status: string }): { ok: boolean; error?: string } {
  const verified = verifyRazorpayPayment({ order_id: payload.order_id, payment_id: payload.payment_id, signature: payload.signature });
  if (!verified.ok) return verified;

  // Find billing by razorpay_order_id
  const bill = getDb().prepare("SELECT * FROM billing_records WHERE razorpay_order_id = ?").get(payload.order_id) as BillingRecord | undefined;
  if (!bill) return { ok: false, error: "No billing record for this order." };

  const now = new Date().toISOString();
  if (payload.status === "paid" || payload.status === "captured") {
    getDb().prepare("UPDATE billing_records SET status = 'paid', paid_amount = total_amount, razorpay_payment_id = ?, paid_at = ?, updated_at = ? WHERE id = ?")
      .run(payload.payment_id, now, now, bill.id);
    getDb().prepare("UPDATE payment_transactions SET razorpay_payment_id = ?, status = 'paid', webhook_verified = 1, updated_at = ? WHERE razorpay_order_id = ?")
      .run(payload.payment_id, now, payload.order_id);
  } else if (payload.status === "failed") {
    getDb().prepare("UPDATE billing_records SET status = 'failed', updated_at = ? WHERE id = ?").run(now, bill.id);
    getDb().prepare("UPDATE payment_transactions SET status = 'failed', updated_at = ? WHERE razorpay_order_id = ?").run(now, payload.order_id);
  }
  return { ok: true };
}
