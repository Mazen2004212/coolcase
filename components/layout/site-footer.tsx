import Image from "next/image";
import Link from "next/link";
import { SiteContainer } from "@/components/layout/site-container";
import { getCustomer } from "@/lib/auth/user";

export async function SiteFooter() {
  const customer = await getCustomer();
  return (
    <footer id="footer" className="site-footer">
      <SiteContainer>
        <div className="footer-main">
          <div className="footer-brand">
            <Link href="#top" className="brand-wordmark" aria-label="Back to top">
              <Image
                src="/assets/logo/coolcase-logo.png"
                alt="Coolcase"
                width={140}
                height={26}
                style={{ height: 26, width: 'auto', objectFit: 'contain', filter: 'invert(1)' }}
              />
            </Link>
            <p>Phone cases with a point of view.</p>
          </div>
          <nav aria-label="Shop links"><h2>Shop</h2><ul><li><Link href="/shop" prefetch={false}>All Cases</Link></li><li><Link href="/collections" prefetch={false}>Collections</Link></li><li><Link href="/custom-cases" prefetch={false}>Custom Cases</Link></li></ul></nav>
          <nav aria-label="Help links"><h2>Help</h2><ul><li><Link href="/track-order" prefetch={false}>Track Order</Link></li><li><Link href="/contact" prefetch={false}>Contact</Link></li></ul></nav>
          <nav aria-label="About links"><h2>About</h2><ul><li><Link href="/about" prefetch={false}>About Coolcase</Link></li></ul></nav>
          <nav aria-label="Account links"><h2>Account</h2><ul>{customer ? <><li><Link href="/account" prefetch={false}>My Account</Link></li><li><Link href="/account/orders" prefetch={false}>My Orders</Link></li></> : <><li><Link href="/login" prefetch={false}>Login</Link></li><li><Link href="/signup" prefetch={false}>Create Account</Link></li></>}</ul></nav>
        </div>
        <div className="footer-bottom"><p>© Coolcase</p></div>
      </SiteContainer>
    </footer>
  );
}
