import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CustomerPageShell } from "@/components/layout/customer-page-shell";
import { SiteContainer } from "@/components/layout/site-container";

export default function NotFound() {
  return <CustomerPageShell><section className="not-found-page"><SiteContainer><p>404 / Case not found</p><h1>LOOKS LIKE THIS PAGE DOESN&apos;T FIT.</h1><span>The page may have moved, or the case you&apos;re looking for is not available.</span><div><Link href="/shop">Shop Cases <ArrowRight aria-hidden="true" /></Link><Link href="/">Return Home</Link></div></SiteContainer></section></CustomerPageShell>;
}
