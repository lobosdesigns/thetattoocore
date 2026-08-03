export function SellerCheckoutFields({
  defaultUrl = "",
}: {
  defaultUrl?: string | null;
}) {
  return (
    <fieldset className="space-y-3 rounded-md border border-[var(--card-rim)] bg-[var(--paper-soft)] p-3">
      <legend className="px-1 text-xs font-bold uppercase text-[var(--muted-strong)]">
        Seller checkout
      </legend>
      <label className="block text-xs font-bold uppercase text-[var(--muted-strong)]">
        Stripe Payment Link
        <input
          className="mt-1 h-11 w-full rounded-md border border-[var(--card-rim)] bg-[var(--paper-warm)] px-3 text-sm font-normal text-[var(--foreground)]"
          defaultValue={defaultUrl ?? ""}
          maxLength={500}
          name="external_checkout_url"
          placeholder="https://buy.stripe.com/..."
          required
          type="url"
        />
      </label>
      <label className="flex items-start gap-3 text-sm leading-6 text-[var(--muted)]">
        <input
          className="mt-1 size-4 shrink-0 accent-[var(--gold)]"
          name="seller_checkout_terms_accepted"
          required
          type="checkbox"
        />
        <span>
          I confirm this live checkout link matches the listed physical product and
          price, and I handle payment, taxes, shipping, fulfillment, returns,
          refunds, disputes, customer support, and legal compliance.
        </span>
      </label>
    </fieldset>
  );
}
