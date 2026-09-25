'use client';

import Link from 'next/link';
import { FeedbackRegion, ErrorState } from '@/components/ui/feedback';
import { useEffect, useState } from 'react';

import { fetchAllSettings, upsertSettings } from '@/app/admin/actions/settings';
import { money } from '@/lib/admin/analytics';
import { parseFiniteNumber, parseStoredBoolean } from '@/lib/settings/parsers';

import { Field, PageHeading, Panel, Toggle } from './admin-ui';
import { ShippingOrdersLive } from './shipping-orders-live';

const SETTINGS_FORM_KEYS = [
  'store_name',
  'support_email',
  'support_phone',
  'whatsapp_number',
  'cod_enabled',
  'instapay_enabled',
  'instapay_number',
  'email_sender_name',
  'silicone_original_price',
  'silicone_selling_price',
  'acrylic_original_price',
  'acrylic_selling_price',
  'double_layer_original_price',
  'double_layer_selling_price',
] as const;

const MATERIAL_PRICE_FIELDS = [
  {
    label: 'Silicone',
    originalKey: 'silicone_original_price',
    sellingKey: 'silicone_selling_price',
    originalFallback: 230,
    sellingFallback: 180,
  },
  {
    label: 'Acrylic',
    originalKey: 'acrylic_original_price',
    sellingKey: 'acrylic_selling_price',
    originalFallback: 299,
    sellingFallback: 225,
  },
  {
    label: 'Double Layer',
    originalKey: 'double_layer_original_price',
    sellingKey: 'double_layer_selling_price',
    originalFallback: 460,
    sellingFallback: 399,
  },
] as const;

export function ShippingLive() {
  const [fee, setFee] = useState(0);
  const [originalFee, setOriginalFee] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchAllSettings()
      .then(settings => {
        const shippingSetting = settings.find(
          setting => setting.key === 'shipping_fee',
        );
        if (shippingSetting) {
          const parsedFee = parseFiniteNumber(shippingSetting.value, 0);
          setFee(parsedFee);
          setOriginalFee(parsedFee);
        }
      })
      .catch(() => setMessage('Error: Failed to load shipping settings.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    const result = await upsertSettings([
      { key: 'shipping_fee', value: fee },
    ]);

    if (result.error) {
      setMessage(`Error: ${result.error}`);
    } else {
      setOriginalFee(fee);
      setMessage(`Saved shipping fee as ${money(fee)}`);
    }
    setSaving(false);
  }

  return (
    <>
      <PageHeading
        title="Shipping"
        description="One simple shipping fee for every order."
      />
      <Panel title="Flat shipping">
        {loading ? (
          <p>Loading shipping configuration...</p>
        ) : (
          <form className="ad-narrow-form" onSubmit={handleSave}>
            <Field label="Flat Shipping Fee (EGP)">
              <input
                type="number"
                required
                min="0"
                step="1"
                value={fee}
                onChange={event => setFee(Number(event.target.value))}
                disabled={saving}
              />
            </Field>
            <p>This shipping fee applies to all customer orders at checkout.</p>
            <button
              className="ad-primary"
              type="submit"
              disabled={saving || fee === originalFee}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {message ? (
              <p
                role="status"
                style={{
                  marginTop: 10,
                  color: message.startsWith('Error') ? 'red' : 'green',
                }}
              >
                {message}
              </p>
            ) : null}
          </form>
        )}
      </Panel>
      <Panel title="Future configuration">
        <p>Zone-based shipping can be added later. Flat shipping is the current configuration.</p>
      </Panel>
      <ShippingOrdersLive />
    </>
  );
}

export function SettingsLive() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState('');
  const dirty = saved !== '' && JSON.stringify(settings) !== saved;
  useEffect(() => { if (!dirty) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);

  useEffect(() => {
    fetchAllSettings()
      .then(data => {
        const values = Object.fromEntries(data.map(setting => [setting.key, setting.value]));
        setSettings(values); setSaved(JSON.stringify(values));
      })
      .catch(() => setMessage('Error: Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  function set(key: string, value: unknown) {
    setSettings(current => ({ ...current, [key]: value }));
  }

  function textValue(key: string, fallback = ''): string {
    const value = settings[key];
    return typeof value === 'string' ? value : fallback;
  }

  function numberValue(key: string, fallback: number): number {
    return parseFiniteNumber(settings[key], fallback);
  }

  function booleanValue(key: string, fallback: boolean): boolean {
    return parseStoredBoolean(settings[key], fallback);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();

    if (
      !booleanValue('cod_enabled', true) &&
      !booleanValue('instapay_enabled', true)
    ) {
      setMessage(
        'Error: You must enable at least one payment method (COD or InstaPay).',
      );
      return;
    }

    setSaving(true);
    setMessage('');

    try {
    const result = await upsertSettings(
      SETTINGS_FORM_KEYS.map(key => ({
        key,
        value: settings[key],
      })),
    );

    setMessage(
      result.error
        ? `Error: ${result.error}`
        : 'Settings saved successfully.',
    );
    if (!result.error) setSaved(JSON.stringify(settings));
    } catch { setMessage('Error: Could not save settings. Please retry.'); } finally { setSaving(false); }
  }

  if (loading) return <p style={{ padding: 40 }}>Loading settings...</p>;

  if (!saved) return <ErrorState href="/admin/settings">Settings could not be loaded. Please retry.</ErrorState>;
  return (
    <>
      <PageHeading
        title="Settings"
        description="Store contact details, payment preferences, and global pricing."
      />
      <form onSubmit={handleSave} aria-busy={saving}><p className="cc-helper" role="status">{saving ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}</p><Link className="cc-button" href="/admin/shipping">Shipping settings →</Link><fieldset disabled={saving}>
        <div className="ad-two">
          <Panel title="Store / Contact">
            <Field label="Store name">
              <input
                required
                value={textValue('store_name')}
                onChange={event => set('store_name', event.target.value)}
              />
            </Field>
            <Field label="Support email">
              <input
                type="email"
                required
                value={textValue('support_email')}
                onChange={event => set('support_email', event.target.value)}
              />
            </Field>
            <Field label="Support phone">
              <input
                type="tel"
                pattern="01[0125][0-9]{8}"
                required
                value={textValue('support_phone')}
                onChange={event => set('support_phone', event.target.value)}
              />
            </Field>
            <Field label="WhatsApp">
              <input
                type="tel"
                pattern="01[0125][0-9]{8}"
                required
                value={textValue('whatsapp_number')}
                onChange={event => set('whatsapp_number', event.target.value)}
              />
            </Field>
          </Panel>

          <Panel title="Checkout / Payments"><p>Enabled methods appear at checkout. InstaPay instructions are shown after an order is placed.</p>
            <Toggle
              label="COD enabled"
              checked={booleanValue('cod_enabled', true)}
              onChange={value => set('cod_enabled', value)}
            />
            <Toggle
              label="InstaPay enabled"
              checked={booleanValue('instapay_enabled', true)}
              onChange={value => set('instapay_enabled', value)}
            />
            <Field label="InstaPay number">
              <input
                type="tel"
                pattern="01[0125][0-9]{8}"
                required
                value={textValue('instapay_number')}
                onChange={event => set('instapay_number', event.target.value)}
              />
            </Field>
          </Panel>

          <Panel title="Global material pricing">
            <p>
              Product-level overrides take precedence. Prices are whole EGP amounts.
            </p>
            {MATERIAL_PRICE_FIELDS.map(field => (
              <div className="ad-material-price" key={field.label}>
                <strong>{field.label}</strong>
                <div className="ad-form-grid" style={{ marginTop: 10 }}>
                  <Field label="Original price (EGP)">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={numberValue(
                        field.originalKey,
                        field.originalFallback,
                      )}
                      onChange={event =>
                        set(field.originalKey, Number(event.target.value))
                      }
                    />
                  </Field>
                  <Field label="Selling price (EGP)">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={numberValue(
                        field.sellingKey,
                        field.sellingFallback,
                      )}
                      onChange={event =>
                        set(field.sellingKey, Number(event.target.value))
                      }
                    />
                  </Field>
                </div>
              </div>
            ))}
          </Panel>

          <Panel title="Email">
            <Field label="Sender name">
              <input
                required
                value={textValue('email_sender_name')}
                onChange={event => set('email_sender_name', event.target.value)}
              />
            </Field>
            <details>
              <summary>Coupon email template preview</summary>
              <div className="ad-email">
                <strong>A special Coolcase discount for you</strong>
                <p>Hi [Customer Name],</p>
                <p>We have a special offer for you from Coolcase.</p>
                <p>Use coupon: [Coupon Code]</p>
                <p>Discount: [Discount information] off eligible Coolcase products.</p>
                <p>Enter the code at checkout before it expires.</p>
                <p>{textValue('email_sender_name', 'Coolcase')}</p>
              </div>
            </details>
            <p>Order emails use the store’s configured sender details.</p>
          </Panel>
        </div>

        <FeedbackRegion tone={message.startsWith("Error") ? "danger" : "success"}>{message}</FeedbackRegion>

        <div className="ad-savebar">
          <button
            className="ad-primary"
            type="submit"
            disabled={saving || !dirty || Object.keys(settings).length === 0}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </fieldset></form>
    </>
  );
}
