export const money = (value: number) => `${value.toLocaleString('en-EG', { maximumFractionDigits: 2 })} EGP`;
export const shortDate = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
