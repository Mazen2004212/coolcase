**# Coolcase — User Flows**



**This document describes expected customer and admin journeys.**



**---**



**# CUSTOMER FLOW 1 — Browse Store**



**User visits:**



**`/`**



**User sees:**



**Homepage hero**



**Featured cases**



**Categories**



**Custom Cases section**



**User selects:**



**`Shop Now`**



**or a product/category.**



**User arrives at:**



**`/shop`**



**or:**



**`/shop/\[slug]`**



**---**



**# CUSTOMER FLOW 2 — Configure Standard Case**



**User opens a case design.**



**User sees product:**



**- Images**

**- Name**

**- Description**

**- Material selector**

**- Phone selector**

**- 4G / 5G selector**

**- Price**

**- Add to Cart**



**User selects material.**



**If:**



**Silicone**



**Display:**



**`150 EGP`**



**If:**



**Acrylic**



**Display:**



**`200 EGP`**



**Display message:**



**`Acrylic is stronger and more rigid for improved protection.`**



**Price displayed on the client is informational.**



**Server revalidates authoritative price later.**



**---**



**# CUSTOMER FLOW 3 — Choose Phone**



**User opens phone selector.**



**Available iPhone models:**



**iPhone X through iPhone 16 Pro Max.**



**Last option:**



**`Other`**



**Display note:**



**`Can't find your phone? Select Other and enter your exact phone model.`**



**If user selects:**



**`Other`**



**show:**



**`Exact Phone Model`**



**Example:**



**`Samsung Galaxy A55`**



**Field becomes required.**



**---**



**# CUSTOMER FLOW 4 — Network Version**



**User selects:**



**`4G`**



**or:**



**`5G`**



**Selection is required.**



**This information becomes part of the order item.**



**---**



**# CUSTOMER FLOW 5 — Add Product To Cart**



**User clicks:**



**`Add to Cart`**



**Application validates required configuration.**



**Cart item contains:**



**- Product**

**- Product image**

**- Material**

**- Phone model**

**- Custom phone model where applicable**

**- Network version**

**- Quantity**



**User may continue shopping or open cart.**



**---**



**# CUSTOMER FLOW 6 — Custom Case**



**User visits:**



**`/custom-case`**



**User uploads artwork/image.**



**System validates file.**



**User selects:**



**- Silicone / Acrylic**

**- Phone model**

**- Exact model when Other**

**- 4G / 5G**



**System creates a configured cart item linked to the uploaded artwork.**



**Artwork should not become publicly accessible.**



**---**



**# CUSTOMER FLOW 7 — Cart**



**User visits:**



**`/cart`**



**User sees every configured item.**



**User can:**



**- Change quantity**

**- Remove item**

**- Continue shopping**

**- Proceed to Checkout**



**Displayed totals are recalculated on the server when order creation occurs.**



**---**



**# CUSTOMER FLOW 8 — Authentication During Checkout**



**If checkout requires login and user is not authenticated:**



**User is sent to:**



**`/login`**



**or:**



**`/signup`**



**After successful authentication, return user to checkout without losing cart state.**



**---**



**# CUSTOMER FLOW 9 — Delivery Address**



**At checkout user chooses:**



**Existing saved address**



**or:**



**Add New Address**



**New address fields:**



**Full Name**



**Phone Number**



**Alternative Phone Number optional**



**Governorate**



**City / Area**



**Street Name**



**Building Number**



**Floor optional**



**Apartment optional**



**Nearest Landmark optional**



**Delivery Notes optional**



**Address Label optional**



**User continues to payment.**



**---**



**# CUSTOMER FLOW 10 — Order Summary**



**Checkout shows:**



**Items**



**Material**



**Phone**



**Network version**



**Quantity**



**Subtotal**



**Shipping**



**Final total**



**Initial shipping fee:**



**`50 EGP`**



**Server remains authoritative for all totals.**



**---**



**# CUSTOMER FLOW 11 — InstaPay**



**Customer chooses:**



**`InstaPay`**



**System shows:**



**- InstaPay QR**

**- Amount to transfer**

**- Instructions**

**- Upload payment proof**



**Customer uploads proof.**



**Customer submits order.**



**Payment becomes:**



**`PENDING\_VERIFICATION`**



**Order becomes:**



**`PENDING\_CONFIRMATION`**



**Admin must review payment proof.**



**Customer must not see the order as fully paid before verification.**



**---**



**# CUSTOMER FLOW 12 — Cash On Delivery**



**Customer selects:**



**`Cash on Delivery`**



**Customer submits order.**



**Payment record uses the appropriate non-prepaid state.**



**Order becomes:**



**`PENDING\_CONFIRMATION`**



**Admin may then confirm order.**



**---**



**# CUSTOMER FLOW 13 — Order Success**



**After successful order creation:**



**Display:**



**`Order Received`**



**Display unique order number.**



**Example:**



**`CC-7K29PM`**



**Show actions:**



**`View Order`**



**`Track Order`**



**Order should immediately appear under:**



**`My Orders`**



**---**



**# CUSTOMER FLOW 14 — My Orders**



**Authenticated user visits:**



**`/account/orders`**



**User sees only their own orders.**



**Order card/row contains:**



**- Order number**

**- Date**

**- Total**

**- Payment method**

**- Current status**



**Clicking an order opens its details.**



**---**



**# CUSTOMER FLOW 15 — Order Tracking**



**Customer visits order details or tracking interface.**



**Timeline may show:**



**Order Received**



**Confirmed**



**Preparing**



**Shipped**



**Out for Delivery**



**Delivered**



**Current step is visually highlighted.**



**Cancelled orders display cancellation state appropriately.**



**Timeline data must originate from real stored order status history.**



**---**



**# ADMIN FLOW 1 — Admin Login**



**Admin authenticates using secure authentication.**



**Application verifies ADMIN role server-side.**



**If role is not ADMIN:**



**Access denied.**



**Do not rely on client-side redirection alone.**



**---**



**# ADMIN FLOW 2 — Dashboard**



**Admin opens:**



**`/admin`**



**Dashboard displays real data such as:**



**Orders Today**



**Pending Confirmation**



**Pending Payment Verification**



**Preparing**



**Shipped**



**Delivered**



**No fake statistics.**



**---**



**# ADMIN FLOW 3 — Order List**



**Admin opens:**



**`/admin/orders`**



**Admin can:**



**Search order number**



**Search customer**



**Filter by order status**



**Filter by payment status**



**Filter by payment method**



**Sort by creation date**



**Open order**



**---**



**# ADMIN FLOW 4 — Order Details**



**Admin opens an order.**



**Display:**



**Order number**



**Created date**



**Customer**



**Phone**



**Delivery address**



**Items**



**Product design**



**Material**



**Phone model**



**Custom phone model**



**4G / 5G**



**Custom artwork when applicable**



**Payment method**



**Payment status**



**Payment proof**



**Subtotal**



**Shipping**



**Total**



**Current order status**



**Status history**



**Admin actions must be permission protected.**



**---**



**# ADMIN FLOW 5 — Verify InstaPay Payment**



**Admin opens InstaPay order.**



**Admin inspects payment proof.**



**If correct:**



**Click:**



**`Verify Payment`**



**System:**



**Sets payment status to VERIFIED**



**Records verifier**



**Records timestamp**



**Writes audit log**



**Admin may confirm order according to business workflow.**



**If invalid:**



**Click:**



**`Reject Payment`**



**Admin can enter rejection reason.**



**System:**



**Sets payment status to REJECTED**



**Records audit event**



**---**



**# ADMIN FLOW 6 — Confirm Order**



**Admin reviews order details.**



**Admin sets order to:**



**`CONFIRMED`**



**System adds order status history entry.**



**Customer tracking updates.**



**---**



**# ADMIN FLOW 7 — Prepare Order**



**Admin changes:**



**`CONFIRMED`**



**to:**



**`PREPARING`**



**History record created.**



**Customer tracking updates.**



**---**



**# ADMIN FLOW 8 — Ship Order**



**Admin changes:**



**`PREPARING`**



**to:**



**`SHIPPED`**



**System records shipping timestamp.**



**History record created.**



**Customer tracking updates.**



**---**



**# ADMIN FLOW 9 — Out For Delivery**



**Admin changes:**



**`SHIPPED`**



**to:**



**`OUT\_FOR\_DELIVERY`**



**History record created.**



**Customer tracking updates.**



**---**



**# ADMIN FLOW 10 — Delivered**



**Admin changes:**



**`OUT\_FOR\_DELIVERY`**



**to:**



**`DELIVERED`**



**System records delivered timestamp.**



**History record created.**



**Order becomes completed from customer perspective.**



**---**



**# ADMIN FLOW 11 — Cancel Order**



**Where allowed, admin changes status to:**



**`CANCELLED`**



**Optional cancellation reason should be supported.**



**Cancellation event is stored in history/audit log.**



**---**



**# ADMIN FLOW 12 — Product Management**



**Admin visits:**



**`/admin/products`**



**Admin can:**



**Create product**



**Edit product**



**Manage product images**



**Select category**



**Toggle Featured**



**Toggle Active**



**Adjust display order**



**Historical order snapshots remain unchanged if product is edited later.**



**---**



**# ADMIN FLOW 13 — Store Settings**



**Admin opens:**



**`/admin/settings`**



**Editable values initially include:**



**Silicone Price**



**Acrylic Price**



**Shipping Fee**



**InstaPay QR**



**InstaPay Instructions**



**Changes apply only to newly priced orders.**



**Existing order snapshots remain unchanged.**



**---**



**# ERROR FLOW — Price Manipulation**



**Customer modifies browser request and tries to submit:**



**Acrylic price = 1 EGP**



**Server ignores submitted price.**



**Server loads configured Acrylic price.**



**Order is calculated correctly.**



**---**



**# ERROR FLOW — Unauthorized Admin Access**



**Customer manually visits:**



**`/admin`**



**Server validates authenticated role.**



**Role = CUSTOMER.**



**Return access denied / appropriate redirect.**



**No admin data is returned.**



**---**



**# ERROR FLOW — Other Phone Without Model**



**Customer selects:**



**`Other`**



**but leaves exact model empty.**



**Validation blocks add-to-cart or checkout.**



**Display useful field error.**



**---**



**# ERROR FLOW — Missing Network Version**



**Customer does not select 4G or 5G.**



**Validation blocks configuration completion.**



**---**



**# ERROR FLOW — Invalid Upload**



**Customer uploads unsupported or oversized file.**



**Server rejects file.**



**Display safe human-readable error.**



**Do not expose stack traces or internal storage details.**



**---**



**# ERROR FLOW — Another Customer's Order**



**Customer A manually enters an order ID belonging to Customer B.**



**Server ownership validation fails.**



**Customer A receives no Customer B order data.**



**This protection is mandatory.**

