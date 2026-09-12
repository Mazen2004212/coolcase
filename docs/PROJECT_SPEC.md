**# Coolcase — Production E-Commerce Project Specification**



**## 1. Project Overview**



**Coolcase is a production-ready e-commerce website focused on selling customizable phone cases in Egypt.**



**The system consists of:**



**- Public storefront**

**- Product browsing**

**- Custom phone case ordering**

**- Shopping cart**

**- Checkout**

**- Customer authentication**

**- Customer account**

**- Saved addresses**

**- Order history**

**- Order tracking**

**- InstaPay payment proof flow**

**- Cash on Delivery**

**- Admin authentication**

**- Admin dashboard**

**- Product management**

**- Order management**

**- Payment verification**

**- Customer management**

**- Store settings**

**- Order status history**



**This is a real production project, not a prototype.**



**Code quality, security, validation, responsive design, maintainability, accessibility, database integrity, and production readiness are required.**



**---**



**# 2. Brand**



**Brand Name:**



**Coolcase**



**Primary visual style:**



**- Premium**

**- Minimal**

**- Modern**

**- Black and white**

**- Product-focused**

**- Clean typography**

**- High-quality phone-case imagery**



**The homepage visual reference is located at:**



**`/docs/reference/homepage-reference.png`**



**The reference image is the primary source of truth for the homepage visual direction.**



**Do not blindly recreate rasterized UI elements from the image.**



**UI text, buttons, navigation, product cards, prices, forms, controls, and interactive components must be implemented in real HTML/React.**



**Images and videos must be loaded from `/public/assets`.**



**---**



**# 3. Recommended Technology Stack**



**Frontend and server:**



**- Next.js**

**- App Router**

**- TypeScript**

**- React**

**- Tailwind CSS**



**UI:**



**- shadcn/ui when appropriate**

**- Lucide icons when they match the reference design**

**- Custom components when necessary**



**Backend:**



**- Next.js server-side functionality**

**- Server Actions and/or Route Handlers**



**Database:**



**- Supabase PostgreSQL**



**Authentication:**



**- Supabase Auth**



**Storage:**



**- Supabase Storage**



**Validation:**



**- Zod**



**Forms:**



**- React Hook Form where appropriate**



**Testing:**



**- Vitest for unit/integration tests where appropriate**

**- Playwright for critical end-to-end user flows**



**Deployment target:**



**- Vercel for the Next.js application**

**- Supabase for database, authentication, and storage**



**Do not introduce microservices.**



**Use a modular monolith architecture.**



**---**



**# 4. Main Website Routes**



**Expected public routes:**



**`/`**

**Homepage**



**`/shop`**

**All products**



**`/shop/\[slug]`**

**Product details**



**`/custom-case`**

**Custom case builder**



**`/cart`**

**Shopping cart**



**`/checkout`**

**Checkout**



**`/login`**

**Customer login**



**`/signup`**

**Customer registration**



**`/account`**

**Customer account overview**



**`/account/orders`**

**Customer orders**



**`/account/orders/\[orderNumber]`**

**Order details and tracking**



**`/account/addresses`**

**Customer addresses**



**`/track-order`**

**Public or authenticated order tracking interface**



**`/about`**

**About Coolcase**



**`/contact`**

**Contact page**



**Admin routes:**



**`/admin`**



**`/admin/orders`**



**`/admin/orders/\[id]`**



**`/admin/products`**



**`/admin/products/new`**



**`/admin/products/\[id]`**



**`/admin/customers`**



**`/admin/payments`**



**`/admin/settings`**



**All `/admin/\*` routes must be protected server-side.**



**---**



**# 5. Homepage**



**The homepage must follow the supplied visual reference.**



**Main structure:**



**1. Black navigation bar**

**2. Hero section**

**3. Benefits / trust indicators**

**4. Product/category navigation**

**5. Featured Collection**

**6. Custom Cases banner**

**7. Store benefits section**

**8. Footer**



**---**



**# 6. Navigation**



**Desktop navigation should contain:**



**- Logo**

**- Home**

**- Shop**

**- iPhone Cases**

**- Custom Cases**

**- About**

**- Contact**

**- Search**

**- Account**

**- Cart**



**Mobile must use an appropriate responsive navigation pattern.**



**Cart icon must show the current cart quantity.**



**---**



**# 7. Hero Section**



**The homepage hero follows the reference composition.**



**Left side:**



**Headline:**



**`Style.`**

**`Protection.`**

**`You.`**



**Supporting text:**



**`Premium phone cases designed for real life. Express your style. Keep your phone safe.`**



**Primary CTA:**



**`Shop Now`**



**Right side:**



**A video/media section.**



**Expected asset paths:**



**`/assets/hero/hero-video.mp4`**



**Fallback poster:**



**`/assets/hero/hero-poster.webp`**



**Video should:**



**- Load efficiently**

**- Use a poster**

**- Be responsive**

**- Avoid layout shifts**

**- Support play/pause**

**- Respect reduced-motion preferences when appropriate**



**---**



**# 8. Store Benefits**



**Homepage should communicate benefits such as:**



**- Drop Protection**

**- Premium Materials**

**- Fast Shipping**

**- Premium Quality**

**- Hassle-Free Experience**



**Final wording may be adjusted before production launch.**



**Do not display false claims such as exact drop-height ratings or customer counts unless explicitly configured and approved.**



**---**



**# 9. Product Categories**



**Initial categories may include:**



**- All Cases**

**- iPhone Cases**

**- Custom Cases**

**- Clear Cases**

**- Tough Cases**

**- MagSafe Cases**



**Do not hardcode category logic into presentation components.**



**Categories should eventually come from application data/database.**



**---**



**# 10. Products**



**A product contains at minimum:**



**- Name**

**- Slug**

**- Description**

**- Images**

**- Category**

**- Active/inactive status**

**- Featured status**

**- Display order**

**- Created date**

**- Updated date**



**Products represent case designs/styles.**



**Material and device compatibility are selected by the customer during ordering.**



**---**



**# 11. Case Materials**



**The store initially supports two case materials.**



**## Silicone**



**Price:**



**`150 EGP`**



**Customer-facing description example:**



**`Soft, lightweight and comfortable for everyday use.`**



**## Acrylic**



**Price:**



**`200 EGP`**



**Customer-facing description example:**



**`Stronger and more rigid for improved protection.`**



**Acrylic should be visually presented as the stronger/premium option.**



**Current prices are initial business rules.**



**They must ultimately be stored in configurable store settings rather than permanently hardcoded in frontend components.**



**---**



**# 12. Server-Side Pricing Rule**



**The client must NEVER be trusted to submit authoritative prices.**



**The frontend may submit:**



**- selected material**

**- product**

**- quantity**



**The server calculates:**



**- unit price**

**- subtotal**

**- shipping**

**- total**



**Example:**



**If material = `acrylic`**



**Server determines:**



**`unit\_price = 200`**



**If material = `silicone`**



**Server determines:**



**`unit\_price = 150`**



**Never accept a client-provided total as authoritative.**



**---**



**# 13. Supported iPhone Models**



**Initial supported iPhone models:**



**- iPhone X**

**- iPhone XS**

**- iPhone XS Max**

**- iPhone XR**



**- iPhone 11**

**- iPhone 11 Pro**

**- iPhone 11 Pro Max**



**- iPhone 12 mini**

**- iPhone 12**

**- iPhone 12 Pro**

**- iPhone 12 Pro Max**



**- iPhone 13 mini**

**- iPhone 13**

**- iPhone 13 Pro**

**- iPhone 13 Pro Max**



**- iPhone 14**

**- iPhone 14 Plus**

**- iPhone 14 Pro**

**- iPhone 14 Pro Max**



**- iPhone 15**

**- iPhone 15 Plus**

**- iPhone 15 Pro**

**- iPhone 15 Pro Max**



**- iPhone 16**

**- iPhone 16 Plus**

**- iPhone 16 Pro**

**- iPhone 16 Pro Max**



**Final option:**



**`Other`**



**The model list must not be buried inside random UI components.**



**Use a centralized data source initially and make it database/configurable later if required.**



**---**



**# 14. Other Phone Models**



**If customer selects:**



**`Other`**



**display a required field:**



**`Exact Phone Model`**



**Placeholder example:**



**`Samsung Galaxy A55`**



**Display the note:**



**`Can't find your phone? Select Other and enter your exact phone model.`**



**Do not allow checkout when `Other` is selected and the exact phone model is empty.**



**---**



**# 15. 4G / 5G Selection**



**Each configured case order must include network/device version:**



**- 4G**

**- 5G**



**Field name concept:**



**`Network Version`**



**This is required because some phone variants can have different physical dimensions.**



**For iPhone models where the distinction is not materially relevant, the system may still retain this field until the business rules are refined.**



**The selected value must be stored on the order item.**



**---**



**# 16. Custom Case Builder**



**Route:**



**`/custom-case`**



**Customer should be able to:**



**1. Upload a custom image/design**

**2. Select Silicone or Acrylic**

**3. Select phone model**

**4. Select 4G or 5G**

**5. Preview basic order details**

**6. Add configured case to cart**



**Uploaded customer designs must be stored securely.**



**Do not expose private customer uploads through unrestricted public storage URLs.**



**Supported file formats should initially be limited to common image formats.**



**Validate:**



**- MIME type**

**- file extension**

**- file size**



**The final file size limit should be configurable.**



**---**



**# 17. Cart**



**Cart must support:**



**- One or multiple items**

**- Product/design image**

**- Product name**

**- Material**

**- Phone model**

**- Custom phone model if applicable**

**- 4G/5G**

**- Quantity**

**- Unit price**

**- Line total**

**- Remove item**

**- Update quantity**



**Prices shown in the cart must be recalculated/verified by the server before checkout completion.**



**---**



**# 18. Shipping**



**Initial shipping fee:**



**`50 EGP`**



**Current business rule:**



**Flat shipping fee for the whole order.**



**Example:**



**Silicone case:**



**Case: `150 EGP`**



**Shipping: `50 EGP`**



**Total: `200 EGP`**



**Acrylic case:**



**Case: `200 EGP`**



**Shipping: `50 EGP`**



**Total: `250 EGP`**



**Shipping fee must ultimately be configurable from Admin Settings.**



**Do not permanently hardcode `50` throughout the codebase.**



**---**



**# 19. Checkout**



**Checkout should feel similar to a professional e-commerce checkout such as Amazon in terms of clarity and address collection, without copying branding or proprietary UI.**



**Required customer fields:**



**- Full Name**

**- Mobile Number**



**Optional:**



**- Alternative Phone Number**



**Required delivery fields:**



**- Governorate**

**- City / Area**

**- Street Name**

**- Building Number**



**Optional/recommended fields:**



**- Floor**

**- Apartment**

**- Nearest Landmark**

**- Additional Delivery Notes**

**- Address Label / Type**



**Address type values may include:**



**- Home**

**- Work**

**- Other**



**Customer must review order summary before submission.**



**---**



**# 20. Payment Methods**



**Initial payment methods:**



**- InstaPay**

**- Cash on Delivery**



**Enum/internal values:**



**`INSTAPAY`**



**`CASH\_ON\_DELIVERY`**



**---**



**# 21. InstaPay Flow**



**When customer selects InstaPay:**



**Show:**



**- Store InstaPay QR code**

**- Amount that must be transferred**

**- Payment instructions**

**- Payment proof upload field**



**Expected QR asset:**



**`/assets/payment/instapay-qr.webp`**



**Do not mark an InstaPay payment as paid merely because the QR code was displayed.**



**Correct flow:**



**Customer submits order.**



**Customer uploads transfer receipt/proof.**



**Payment status becomes:**



**`PENDING\_VERIFICATION`**



**Admin reviews payment proof.**



**Admin can:**



**- Verify payment**

**- Reject payment**



**Only admin/server logic can mark a payment as verified.**



**---**



**# 22. Cash on Delivery Flow**



**When customer selects:**



**`Cash on Delivery`**



**No payment proof is required.**



**Order is created with appropriate pending status.**



**Admin must confirm/process the order.**



**---**



**# 23. Payment Statuses**



**Internal payment statuses:**



**- PENDING**

**- PENDING\_VERIFICATION**

**- VERIFIED**

**- REJECTED**

**- NOT\_REQUIRED**

**- REFUNDED**



**Use only statuses applicable to the actual payment method.**



**---**



**# 24. Order Lifecycle**



**Internal order statuses:**



**- PENDING\_CONFIRMATION**

**- CONFIRMED**

**- PREPARING**

**- SHIPPED**

**- OUT\_FOR\_DELIVERY**

**- DELIVERED**

**- CANCELLED**



**Additional payment-related state should remain in the payment entity rather than overloading order status unnecessarily.**



**Customer-facing wording may simplify technical statuses.**



**---**



**# 25. Order Status Timeline**



**Customer tracking page should show a visual timeline such as:**



**Order Received**



**↓**



**Confirmed**



**↓**



**Preparing**



**↓**



**Shipped**



**↓**



**Out for Delivery**



**↓**



**Delivered**



**Each status change must be stored in order status history.**



**Admin status changes must not overwrite historical events.**



**---**



**# 26. Order Numbers**



**Do not expose simple sequential database IDs as customer-facing order numbers.**



**Example format:**



**`CC-7K29PM`**



**Order numbers must be unique.**



**Database IDs may use UUIDs internally.**



**---**



**# 27. Customer Account**



**Authenticated customers should be able to access:**



**- Profile**

**- Saved addresses**

**- Orders**

**- Order details**

**- Order tracking**

**- Logout**



**Future features may include:**



**- Wishlist**

**- Saved designs**



**Do not implement future features unless required.**



**---**



**# 28. Authentication**



**Roles:**



**- CUSTOMER**

**- ADMIN**



**Customer registration should initially support:**



**- Name**

**- Email**

**- Password**

**- Phone number**



**Authentication is handled by Supabase Auth.**



**Application profile data belongs in application tables.**



**Role authorization must be enforced server-side.**



**Never rely only on hiding Admin UI.**



**---**



**# 29. Admin Access**



**Admin routes must require an authenticated user with ADMIN role.**



**A normal customer attempting to access:**



**`/admin`**



**or any `/admin/\*` route must be denied even if they manually enter the URL.**



**Admin role must not be assignable by the public signup form.**



**---**



**# 30. Admin Dashboard**



**Dashboard overview should include useful store metrics such as:**



**- Orders today**

**- Pending confirmation**

**- Preparing**

**- Shipped**

**- Delivered**

**- Pending InstaPay verification**



**Revenue metrics should only count valid business-defined completed/verified orders.**



**Do not display fake metrics.**



**---**



**# 31. Admin Order Management**



**Admin can:**



**- View all orders**

**- Search by order number**

**- Search customer**

**- Filter by status**

**- Filter by payment method**

**- Filter by payment status**

**- Open order details**

**- View customer information**

**- View delivery address**

**- View ordered products**

**- View material**

**- View phone model**

**- View 4G/5G version**

**- View custom design**

**- View payment proof**

**- Update order status**

**- Cancel order when appropriate**



**Order status changes should create status-history records.**



**---**



**# 32. Admin Payment Management**



**For InstaPay:**



**Admin must be able to view:**



**- Order**

**- Customer**

**- Expected amount**

**- Payment proof**

**- Current payment status**



**Available actions:**



**- Verify**

**- Reject**



**Verification must record:**



**- verifier/admin user**

**- timestamp**



**---**



**# 33. Admin Product Management**



**Admin should eventually support:**



**- Create product**

**- Edit product**

**- Activate/deactivate product**

**- Mark/unmark Featured**

**- Manage images**

**- Manage category**

**- Update title**

**- Update description**

**- Control display order**



**Do not permanently delete products associated with historical orders.**



**Use active/inactive behavior where appropriate.**



**---**



**# 34. Store Settings**



**Admin-configurable settings should include at minimum:**



**- Silicone price**

**- Acrylic price**

**- Shipping fee**

**- InstaPay QR asset/reference**

**- InstaPay payment instructions**

**- Store contact details**



**Current defaults:**



**Silicone:**



**`150 EGP`**



**Acrylic:**



**`200 EGP`**



**Shipping:**



**`50 EGP`**



**Sensitive configuration must not be exposed to unauthorized clients.**



**---**



**# 35. Search**



**Navigation contains a search interface.**



**Initial search should support product names and relevant product text.**



**Search should be usable on mobile and desktop.**



**---**



**# 36. Responsive Design**



**The application must be designed for:**



**- Desktop**

**- Laptop**

**- Tablet**

**- Mobile**



**Do not simply shrink desktop components.**



**Mobile layouts should be intentionally designed.**



**No horizontal overflow is acceptable.**



**---**



**# 37. Accessibility**



**Use semantic HTML.**



**Forms must have accessible labels.**



**Interactive elements must be keyboard accessible.**



**Provide visible focus states.**



**Images require appropriate alt text.**



**Ensure reasonable color contrast.**



**---**



**# 38. Performance**



**Required practices:**



**- Next/Image when appropriate**

**- Optimized WebP/AVIF assets where practical**

**- Lazy loading below-the-fold media**

**- Hero media optimization**

**- No unnecessary client-side JavaScript**

**- Server Components by default**

**- Client Components only when interaction requires them**

**- Avoid large dependency bundles**



**---**



**# 39. Security Requirements**



**This project handles real customer and order data.**



**Required security principles:**



**- Validate all server input**

**- Never trust client-calculated prices**

**- Never trust client role values**

**- Enforce admin permissions server-side**

**- Use Supabase Row Level Security**

**- Never expose Supabase service role key to the browser**

**- Store secrets in environment variables**

**- Validate uploaded files**

**- Restrict payment proof access**

**- Restrict custom design access**

**- Use parameterized/database-safe queries**

**- Prevent unauthorized order access**

**- Prevent IDOR vulnerabilities**

**- Do not expose internal errors to users**

**- Log critical server errors safely**

**- Avoid storing unnecessary sensitive information**



**---**



**# 40. Database Integrity**



**Use foreign keys.**



**Use constraints.**



**Use enums or constrained status values where appropriate.**



**Money values should use an appropriate numeric representation.**



**Do not use floating-point arithmetic for monetary calculations.**



**Server must snapshot relevant order values at purchase time.**



**Example:**



**Even if Acrylic price later changes from 200 EGP to 220 EGP, an existing historical order that was purchased for 200 EGP must remain 200 EGP.**



**---**



**# 41. Order Snapshot Rule**



**Historical orders must retain:**



**- Product title at purchase**

**- Selected material**

**- Selected phone model**

**- Network type**

**- Unit price**

**- Quantity**

**- Shipping amount**

**- Total**



**Do not calculate historical order totals from current store prices.**



**---**



**# 42. Assets**



**Asset base path:**



**`/public/assets`**



**Expected folders:**



**`/public/assets/logo`**



**`/public/assets/hero`**



**`/public/assets/products`**



**`/public/assets/categories`**



**`/public/assets/banners`**



**`/public/assets/payment`**



**`/public/assets/icons`**



**Do not invent random stock images if specified assets are available.**



**---**



**# 43. Reference Design**



**The homepage reference is:**



**`/docs/reference/homepage-reference.png`**



**Implementation should preserve:**



**- Black navbar**

**- Hero composition**

**- White product area**

**- Product-card density**

**- Custom Cases banner**

**- Black footer**

**- Strong black/white contrast**

**- Premium visual tone**



**The production implementation does not need to copy the fake brand name shown in generated reference assets.**



**The actual brand must be:**



**`Coolcase`**



**---**



**# 44. Coding Standards**



**Use:**



**- TypeScript strict mode**

**- Reusable components**

**- Clear module boundaries**

**- Meaningful names**

**- Server/client separation**

**- Centralized validation schemas**

**- Centralized business logic**

**- Centralized pricing logic**



**Avoid:**



**- Giant monolithic components**

**- Duplicated pricing logic**

**- Duplicated status strings**

**- `any` unless absolutely necessary**

**- Hardcoded secrets**

**- Client-only authorization**

**- Placeholder production behavior**



**---**



**# 45. Git Rules**



**Never commit:**



**- `.env.local`**

**- Production secrets**

**- Service role keys**

**- Passwords**

**- Private credentials**

**- Build artifacts**

**- Local dependency directories**



**---**



**# 46. Definition of Done**



**A feature is not complete merely because it renders.**



**It must:**



**- Work on desktop and mobile**

**- Have validation**

**- Handle errors**

**- Respect authentication**

**- Respect authorization**

**- Persist correct data**

**- Use server-side business rules**

**- Pass relevant tests**

**- Not expose sensitive data**

**- Match the approved design**

**- Have no obvious broken states**



**---**



**# 47. Development Strategy**



**Build in controlled phases.**



**Phase 1:**

**Project foundation and design system.**



**Phase 2:**

**Homepage and storefront UI.**



**Phase 3:**

**Database schema and Supabase integration.**



**Phase 4:**

**Authentication and authorization.**



**Phase 5:**

**Product configuration and cart.**



**Phase 6:**

**Checkout and addresses.**



**Phase 7:**

**Orders and server-side pricing.**



**Phase 8:**

**InstaPay and COD.**



**Phase 9:**

**Customer account and tracking.**



**Phase 10:**

**Admin dashboard.**



**Phase 11:**

**Product/settings management.**



**Phase 12:**

**Testing, security review, optimization and deployment.**



**Do not attempt to generate the complete application in one uncontrolled implementation pass.**

