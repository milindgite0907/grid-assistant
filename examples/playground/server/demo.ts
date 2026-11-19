import type { JsonPrompt } from './provider.ts';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const number = (value: unknown): number | undefined => typeof value === 'number' ? value : undefined;

type Facts = { label: string; facts: Record<string, unknown> };

/**
 * Deterministic stand-in for a model, used only by AI_PROVIDER=demo. It restates the
 * supplied context and never contacts a service.
 */
export function demoOutput(prompt: JsonPrompt): unknown {
  const user = JSON.parse(prompt.messages.find((message) => message.role === 'user')?.content ?? '{}');
  return prompt.task === 'chat' ? demoChat(user) : demoSummary(user);
}

function demoSummary(input: { record?: { id?: string; values?: Record<string, unknown> }; related?: Facts[] }) {
  const values = input.record?.values ?? {};
  const amount = number(values.amount) ?? 0;
  const related = input.related ?? [];
  const customer = related[0]?.facts;
  const region = related[1]?.facts;
  const all = related[2]?.facts;
  const highlights: string[] = [];
  const regionAverage = number(region?.averageAmountUsd);
  if (regionAverage) {
    const difference = Math.round(((amount - regionAverage) / regionAverage) * 100);
    highlights.push(`${difference >= 0 ? 'Above' : 'Below'} the ${String(values.region)} average of ${usd.format(regionAverage)} by ${Math.abs(difference)}%.`);
  }
  if (customer) {
    highlights.push(`${String(values.customer)} has ${String(customer.orderCount)} orders totaling ${usd.format(number(customer.totalAmountUsd) ?? 0)}; ${String(customer.openCount)} open and ${String(customer.onHoldCount)} on hold.`);
  }
  if (all) highlights.push(`${String(all.ordersWithLargerAmount)} of ${String(all.orderCount)} orders have a larger amount.`);
  if (values.status === 'On hold') highlights.push('This order is on hold and may need attention.');
  return {
    summary: `Order ${String(input.record?.id)} for ${String(values.customer)} is ${String(values.status)} in ${String(values.region)} with an amount of ${usd.format(amount)}.`,
    highlights,
  };
}

function demoChat(input: { question?: string; context?: Record<string, Record<string, number>> }) {
  const filtered = input.context?.filtered;
  const selected = input.context?.includedSelection;
  const parts = [
    filtered ? `${filtered.rowCount} orders match the current view, totaling ${usd.format(filtered.amount)} (${filtered.openCount} open, ${filtered.onHoldCount} on hold, ${filtered.shippedCount} shipped).` : '',
    selected?.rowCount ? `Your selection includes ${selected.rowCount} orders totaling ${usd.format(selected.amount)}.` : 'No orders are selected.',
  ].filter(Boolean);
  return { answer: `Demo mode (no AI model is connected): ${parts.join(' ')} Configure a provider to answer free-form questions.` };
}
