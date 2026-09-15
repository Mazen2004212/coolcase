"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight } from "lucide-react";

export function TrackOrderForm() {
  const [message, setMessage] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const reference = String(data.get("reference") ?? "").trim();
    const contact = String(data.get("contact") ?? "").trim();
    if (!reference || !contact) return setMessage("Enter your order reference and the email or phone used for the order.");
    setMessage("Order tracking will be available once your order has been created and approved.");
  }
  return <form className="track-form" onSubmit={submit} noValidate><label>Order Reference<input name="reference" required autoComplete="off" placeholder="Example: CC-000123" /></label><label>Email or Phone<input name="contact" required autoComplete="email" placeholder="Used when placing the order" /></label><button type="submit">Track Order <ArrowRight aria-hidden="true" /></button>{message ? <p className="track-message" role="status">{message}</p> : null}</form>;
}
