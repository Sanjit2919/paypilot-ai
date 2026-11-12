const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
const LIVE_BASE = "https://api.paypal.com";

export type PayPalConfig = {
  clientId: string;
  clientSecret: string;
  mode: "sandbox" | "live";
};

export function paypalConfig(): PayPalConfig | null {
  const clientId = process.env.PAYPAL_CLIENT_ID ?? process.env.PAYPAL_SANDBOX_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET ?? process.env.PAYPAL_SANDBOX_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const wantsLive = (process.env.PAYPAL_MODE ?? "sandbox").toLowerCase() === "live";
  const liveExplicitlyAllowed = process.env.PAYPAL_ALLOW_LIVE === "true";
  return {
    clientId,
    clientSecret,
    // Sandbox is the default and a live request without the second opt-in is
    // deliberately downgraded to sandbox so a real payment cannot be initiated accidentally.
    mode: wantsLive && liveExplicitlyAllowed ? "live" : "sandbox",
  };
}

export function paypalConfigured(): boolean {
  return paypalConfig() !== null;
}

function baseUrl(config: PayPalConfig): string {
  return config.mode === "live" ? LIVE_BASE : SANDBOX_BASE;
}

async function accessToken(config: PayPalConfig): Promise<string> {
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const response = await fetch(`${baseUrl(config)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`PayPal auth failed (${response.status})`);
  }
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("PayPal access token missing");
  return data.access_token;
}

export type CreateOrderResult = {
  mode: "sandbox" | "live" | "demo";
  orderId: string;
  approveUrl: string | null;
};

export async function createPayPalOrder(params: {
  amount: number;
  currency: string;
  description: string;
  reference: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<CreateOrderResult> {
  const config = paypalConfig();
  if (!config) {
    return {
      mode: "demo",
      orderId: `DEMO-${Date.now().toString(36).toUpperCase()}`,
      approveUrl: null,
    };
  }

  const token = await accessToken(config);
  const response = await fetch(`${baseUrl(config)}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: params.reference,
          description: params.description.slice(0, 127),
          amount: {
            currency_code: params.currency,
            value: params.amount.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: "PayPilot AI",
        user_action: "PAY_NOW",
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`PayPal order creation failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    id: string;
    links?: { rel: string; href: string }[];
  };
  const approve = data.links?.find((l) => l.rel === "approve")?.href ?? null;
  return { mode: config.mode, orderId: data.id, approveUrl: approve };
}

export type PayPalOrderStatus = {
  status: string;
  amount: number;
  currency: string;
  payerId: string | null;
};

/** Read-only order synchronisation. Never marks an invoice paid by itself. */
export async function getPayPalOrderStatus(orderId: string): Promise<PayPalOrderStatus> {
  const config = paypalConfig();
  if (!config || orderId.startsWith("DEMO-")) return { status: "SIMULATED", amount: 0, currency: "USD", payerId: null };
  const token = await accessToken(config);
  const response = await fetch(`${baseUrl(config)}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = (await response.json()) as {
    status?: string;
    payer?: { payer_id?: string };
    purchase_units?: { amount?: { value?: string; currency_code?: string } }[];
    message?: string;
  };
  if (!response.ok) throw new Error(data.message ?? `PayPal order lookup failed (${response.status})`);
  const amount = data.purchase_units?.[0]?.amount;
  return {
    status: data.status ?? "UNKNOWN",
    amount: amount?.value ? Number.parseFloat(amount.value) : 0,
    currency: amount?.currency_code ?? "USD",
    payerId: data.payer?.payer_id ?? null,
  };
}

export type CaptureResult = {
  mode: "sandbox" | "live" | "demo";
  status: string;
  transactionId: string;
  amount: number;
  currency: string;
};

export async function capturePayPalOrder(orderId: string): Promise<CaptureResult> {
  const config = paypalConfig();
  if (!config || orderId.startsWith("DEMO-")) {
    return {
      mode: "demo",
      status: "COMPLETED",
      transactionId: orderId,
      amount: 0,
      currency: "USD",
    };
  }

  const token = await accessToken(config);
  const response = await fetch(`${baseUrl(config)}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const data = (await response.json()) as {
    status?: string;
    id?: string;
    purchase_units?: {
      payments?: { captures?: { id: string; amount: { value: string; currency_code: string } }[] };
    }[];
    message?: string;
  };

  if (!response.ok) {
    throw new Error(data.message ?? `PayPal capture failed (${response.status})`);
  }

  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    mode: config.mode,
    status: data.status ?? "UNKNOWN",
    transactionId: capture?.id ?? data.id ?? orderId,
    amount: capture ? Number.parseFloat(capture.amount.value) : 0,
    currency: capture?.amount.currency_code ?? "USD",
  };
}
