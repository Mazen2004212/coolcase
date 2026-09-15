"use client";

import { useActionState } from "react";
import { addAddressAction, editAddressAction, updateProfileAction, type AccountActionState } from "@/lib/account/actions";
import { addressToFields, type AddressFields, type AddressRow } from "@/lib/account/address";

const initialAccountState: AccountActionState = { status: "idle" };

function ErrorText({ state, name }: { state: AccountActionState; name: string }) { const message = state.fieldErrors?.[name]?.[0]; return message ? <small role="alert">{message}</small> : null; }

export function ProfileForm({ fullName, phone, email }: { fullName: string; phone: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, initialAccountState);
  return <form className="account-form" action={action} noValidate>{state.message ? <p className={`account-form-message ${state.status === "error" ? "error" : ""}`} role="status">{state.message}</p> : null}<label>Full Name<input name="fullName" defaultValue={fullName} autoComplete="name" required /><ErrorText state={state} name="fullName" /></label><label>Phone Number<input name="phone" defaultValue={phone} type="tel" autoComplete="tel" required /><ErrorText state={state} name="phone" /></label><label>Email Address<input value={email} type="email" disabled /><em>Email changes require a separate verified flow and are not available yet.</em></label><button type="submit" disabled={pending}>{pending ? "Saving…" : "Save Profile"}</button></form>;
}

function AddressFieldsView({ initial, state }: { initial?: AddressFields; state: AccountActionState }) {
  return <div className="address-form-grid"><label>Label<select name="label" defaultValue={initial?.label || "Home"}><option>Home</option><option>Work</option><option>Other</option></select></label><label>Governorate<select name="governorate" defaultValue={initial?.governorate || ""} required><option value="" disabled>Choose governorate</option><option>Cairo</option><option>Giza</option></select><ErrorText state={state} name="governorate" /></label><label>City<input name="city" defaultValue={initial?.city} required /><ErrorText state={state} name="city" /></label><label>Area<input name="area" defaultValue={initial?.area} required /><ErrorText state={state} name="area" /></label><label className="account-wide">Street Name<input name="street" defaultValue={initial?.street} autoComplete="street-address" required /><ErrorText state={state} name="street" /></label><label>Building Number<input name="building" defaultValue={initial?.building} required /><ErrorText state={state} name="building" /></label><label>Floor <span>Optional</span><input name="floor" defaultValue={initial?.floor} /></label><label>Apartment <span>Optional</span><input name="apartment" defaultValue={initial?.apartment} /></label><label className="account-wide">Landmark <span>Optional</span><input name="landmark" defaultValue={initial?.landmark} /></label></div>;
}

export function AddAddressForm() {
  const [state, action, pending] = useActionState(addAddressAction, initialAccountState);
  return <form className="account-form address-form" action={action} noValidate>{state.message ? <p className={`account-form-message ${state.status === "error" ? "error" : ""}`} role="status">{state.message}</p> : null}<AddressFieldsView state={state} /><label className="address-default-check"><input type="checkbox" name="isDefault" />Set as my default address</label><button type="submit" disabled={pending}>{pending ? "Saving…" : "Save Address"}</button></form>;
}

export function EditAddressForm({ address }: { address: AddressRow }) {
  const [state, action, pending] = useActionState(editAddressAction, initialAccountState);
  return <form className="account-form address-form" action={action} noValidate><input type="hidden" name="addressId" value={address.id} />{state.message ? <p className={`account-form-message ${state.status === "error" ? "error" : ""}`} role="status">{state.message}</p> : null}<AddressFieldsView state={state} initial={addressToFields(address)} /><label className="address-default-check"><input type="checkbox" name="isDefault" defaultChecked={address.is_default} />Set as my default address</label><button type="submit" disabled={pending}>{pending ? "Saving…" : "Update Address"}</button></form>;
}

export function ConfirmDeleteButton({ disabled }: { disabled: boolean }) { return <button type="submit" className="address-delete" disabled={disabled} onClick={(event) => { if (!window.confirm("Delete this saved address?")) event.preventDefault(); }}>Delete</button>; }
