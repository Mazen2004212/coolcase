**# Coolcase — Database Schema**



**Database:**



**PostgreSQL via Supabase.**



**Primary keys should use UUIDs unless there is a strong reason not to.**



**All timestamps should use timezone-aware PostgreSQL timestamps.**



**---**



**# 1. profiles**



**Supabase Auth owns authentication users.**



**`profiles` stores application-specific user data.**



**Fields:**



**- id UUID PRIMARY KEY**

**- full\_name TEXT**

**- email TEXT**

**- phone TEXT**

**- role user\_role NOT NULL DEFAULT 'CUSTOMER'**

**- created\_at TIMESTAMPTZ NOT NULL DEFAULT now()**

**- updated\_at TIMESTAMPTZ NOT NULL DEFAULT now()**



**Relationship:**



**`profiles.id` references `auth.users.id`**



**Role enum:**



**- CUSTOMER**

**- ADMIN**



**Security:**



**Customers can access/update only permitted fields in their own profile.**



**Customers cannot promote themselves to ADMIN.**



**---**



**# 2. addresses**



**Fields:**



**- id UUID PRIMARY KEY**

**- user\_id UUID NOT NULL**

**- label TEXT**

**- recipient\_name TEXT NOT NULL**

**- phone TEXT NOT NULL**

**- alternate\_phone TEXT**

**- governorate TEXT NOT NULL**

**- city\_area TEXT NOT NULL**

**- street\_name TEXT NOT NULL**

**- building\_number TEXT NOT NULL**

**- floor TEXT**

**- apartment TEXT**

**- landmark TEXT**

**- delivery\_notes TEXT**

**- is\_default BOOLEAN NOT NULL DEFAULT false**

**- created\_at TIMESTAMPTZ NOT NULL DEFAULT now()**

**- updated\_at TIMESTAMPTZ NOT NULL DEFAULT now()**



**Foreign key:**



**`user\_id -> profiles.id`**



**Customers can access only their own addresses.**



**---**



**# 3. categories**



**Fields:**



**- id UUID PRIMARY KEY**

**- name TEXT NOT NULL**

**- slug TEXT UNIQUE NOT NULL**

**- description TEXT**

**- image\_path TEXT**

**- display\_order INTEGER NOT NULL DEFAULT 0**

**- is\_active BOOLEAN NOT NULL DEFAULT true**

**- created\_at TIMESTAMPTZ NOT NULL DEFAULT now()**

**- updated\_at TIMESTAMPTZ NOT NULL DEFAULT now()**



**---**



**# 4. products**



**Fields:**



**- id UUID PRIMARY KEY**

**- category\_id UUID**

**- name TEXT NOT NULL**

**- slug TEXT UNIQUE NOT NULL**

**- short\_description TEXT**

**- description TEXT**

**- is\_featured BOOLEAN NOT NULL DEFAULT false**

**- is\_active BOOLEAN NOT NULL DEFAULT true**

**- display\_order INTEGER NOT NULL DEFAULT 0**

**- silicone\_price\_override INTEGER**

**- acrylic\_price\_override INTEGER**

**- created\_at TIMESTAMPTZ NOT NULL DEFAULT now()**

**- updated\_at TIMESTAMPTZ NOT NULL DEFAULT now()**



**Foreign key:**



**`category\_id -> categories.id`**



**---**



**# 5. product\_images**



**Fields:**



**- id UUID PRIMARY KEY**

**- product\_id UUID NOT NULL**

**- storage\_path TEXT NOT NULL**

**- original\_storage\_path TEXT**

**- processed\_storage\_path TEXT**

**- alt\_text TEXT**

**- display\_order INTEGER NOT NULL DEFAULT 0**

**- is\_primary BOOLEAN NOT NULL DEFAULT false**

**- created\_at TIMESTAMPTZ NOT NULL DEFAULT now()**



**Foreign key:**



**`product\_id -> products.id`**



**Delete behavior:**



**Images may cascade when an unused product is safely deleted, but historical order records must not depend on this table for their display information.**



**---**



**# 6. store\_settings**



**Store settings should be centrally managed.**



**Possible structure:**



**- id UUID PRIMARY KEY**

**- key TEXT UNIQUE NOT NULL**

**- value JSONB NOT NULL**

**- is\_public BOOLEAN NOT NULL DEFAULT false**

**- updated\_by UUID**

**- updated\_at TIMESTAMPTZ NOT NULL DEFAULT now()**



**Initial settings:**



**`silicone\_price`**



**Value:**



**`150`**



**`acrylic\_price`**



**Value:**



**`200`**



**`shipping\_fee`**



**Value:**



**`50`**



**`currency`**



**Value:**



**`EGP`**



**`instapay\_qr\_path`**



**`instapay\_instructions`**



**Store money values as integer EGP when fractional currency is not currently required, or use integer minor units if the implementation standardizes on minor currency units.**



**Do not use JavaScript floating point as authoritative monetary storage.**



**---**



**# 7. customer\_uploads**



**Used for custom case artwork/design files.**



**Fields:**



**- id UUID PRIMARY KEY**

**- user\_id UUID**

**- storage\_path TEXT NOT NULL**

**- original\_filename TEXT**

**- mime\_type TEXT**

**- file\_size\_bytes BIGINT**

**- upload\_type upload\_type NOT NULL**

**- created\_at TIMESTAMPTZ NOT NULL DEFAULT now()**



**Expected upload types:**



**- PRODUCT\_IMAGE**



**- CUSTOM\_CASE\_DESIGN**

**- PAYMENT\_PROOF**



**Uploads referenced by historical order items or payments must not be deleted.**



**Storage access must be private where appropriate.**



**---**



**# 8. orders**



**Fields:**



**- id UUID PRIMARY KEY**

**- order\_number TEXT UNIQUE NOT NULL**

**- customer\_id UUID**

**- address\_id UUID**

**- customer\_name TEXT NOT NULL**

**- customer\_phone TEXT NOT NULL**

**- alternate\_phone TEXT**



**Address snapshot fields:**



**- governorate TEXT NOT NULL**

**- city\_area TEXT NOT NULL**

**- street\_name TEXT NOT NULL**

**- building\_number TEXT NOT NULL**

**- floor TEXT**

**- apartment TEXT**

**- landmark TEXT**

**- delivery\_notes TEXT**



**Financial fields:**



**- subtotal\_amount INTEGER NOT NULL**

**- shipping\_amount INTEGER NOT NULL**

**- total\_amount INTEGER NOT NULL**

**- currency TEXT NOT NULL DEFAULT 'EGP'**



**Order state:**



**- status order\_status NOT NULL**

**- payment\_method payment\_method NOT NULL**



**Timestamps:**



**- created\_at TIMESTAMPTZ NOT NULL DEFAULT now()**

**- updated\_at TIMESTAMPTZ NOT NULL DEFAULT now()**

**- confirmed\_at TIMESTAMPTZ**

**- shipped\_at TIMESTAMPTZ**

**- delivered\_at TIMESTAMPTZ**

**- cancelled\_at TIMESTAMPTZ**



**Foreign keys:**



**`customer\_id -> profiles.id`**



**`address\_id -> addresses.id`**



**Important:**



**The order contains an address snapshot.**



**If the customer edits or deletes a saved address later, the historical shipping address on the order must remain unchanged.**



**---**



**# 9. order\_items**



**Fields:**



**- id UUID PRIMARY KEY**

**- order\_id UUID NOT NULL**

**- product\_id UUID**

**- product\_name\_snapshot TEXT NOT NULL**

**- product\_image\_snapshot TEXT**

**- material case\_material NOT NULL**

**- phone\_model TEXT NOT NULL**

**- custom\_phone\_model TEXT**

**- network\_type network\_type NOT NULL**

**- custom\_design\_upload\_id UUID**

**- unit\_price INTEGER NOT NULL**

**- quantity INTEGER NOT NULL**

**- line\_total INTEGER NOT NULL**

**- created\_at TIMESTAMPTZ NOT NULL DEFAULT now()**



**Foreign keys:**



**`order\_id -> orders.id`**



**`product\_id -> products.id`**



**`custom\_design\_upload\_id -> customer\_uploads.id`**



**Constraints:**



**`quantity > 0`**



**If phone\_model = `Other`, `custom\_phone\_model` must contain a valid value.**



**Unit price and line total are historical snapshots.**



**---**



**# 10. payments**



**Fields:**



**- id UUID PRIMARY KEY**

**- order\_id UUID UNIQUE NOT NULL**

**- method payment\_method NOT NULL**

**- status payment\_status NOT NULL**

**- expected\_amount INTEGER NOT NULL**

**- currency TEXT NOT NULL DEFAULT 'EGP'**

**- payment\_proof\_upload\_id UUID**

**- verified\_by UUID**

**- verified\_at TIMESTAMPTZ**

**- rejection\_reason TEXT**

**- created\_at TIMESTAMPTZ NOT NULL DEFAULT now()**

**- updated\_at TIMESTAMPTZ NOT NULL DEFAULT now()**



**Foreign keys:**



**`order\_id -> orders.id`**



**`payment\_proof\_upload\_id -> customer\_uploads.id`**



**`verified\_by -> profiles.id`**



**---**



**# 11. order\_status\_history**



**Fields:**



**- id UUID PRIMARY KEY**

**- order\_id UUID NOT NULL**

**- status order\_status NOT NULL**

**- changed\_by UUID**

**- customer\_visible\_note TEXT**

**- internal\_note TEXT**

**- created\_at TIMESTAMPTZ NOT NULL DEFAULT now()**



**Foreign keys:**



**`order\_id -> orders.id`**



**`changed\_by -> profiles.id`**



**Every administrative status change should create a record.**



**Never delete status history during normal operation.**



**---**



**# 12. admin\_audit\_logs**



**Recommended for production.**



**Fields:**



**- id UUID PRIMARY KEY**

**- admin\_id UUID**

**- action TEXT NOT NULL**

**- entity\_type TEXT**

**- entity\_id UUID**

**- metadata JSONB**

**- created\_at TIMESTAMPTZ NOT NULL DEFAULT now()**



**Examples:**



**- PAYMENT\_VERIFIED**

**- PAYMENT\_REJECTED**

**- ORDER\_STATUS\_CHANGED**

**- PRODUCT\_CREATED**

**- PRODUCT\_UPDATED**

**- STORE\_SETTING\_UPDATED**



**---**



**# 13. Enums**



**## user\_role**



**- CUSTOMER**

**- ADMIN**



**## case\_material**



**- SILICONE**

**- ACRYLIC**



**## network\_type**



**- 4G**

**- 5G**



**If PostgreSQL enum naming limitations or conventions make numeric-leading enum values inconvenient, database values may instead be:**



**- FOUR\_G**

**- FIVE\_G**



**Customer UI still displays:**



**- 4G**

**- 5G**



**## payment\_method**



**- INSTAPAY**

**- CASH\_ON\_DELIVERY**



**## payment\_status**



**- PENDING**

**- PENDING\_VERIFICATION**

**- VERIFIED**

**- REJECTED**

**- NOT\_REQUIRED**

**- REFUNDED**



**## order\_status**



**- PENDING\_CONFIRMATION**

**- CONFIRMED**

**- PREPARING**

**- SHIPPED**

**- OUT\_FOR\_DELIVERY**

**- DELIVERED**

**- CANCELLED**



**---**



**# 14. Indexes**



**Create useful indexes for:**



**- products.slug**

**- products.is\_active**

**- products.is\_featured**

**- categories.slug**

**- orders.order\_number**

**- orders.customer\_id**

**- orders.status**

**- orders.created\_at**

**- payments.status**

**- payments.method**

**- order\_status\_history.order\_id**



**Use indexes based on actual query patterns.**



**Do not create unnecessary indexes blindly.**



**---**



**# 15. Row Level Security**



**RLS must be enabled for sensitive tables.**



**Customer rules should ensure:**



**A customer can:**



**- Read their own profile**

**- Read/update permitted own profile fields**

**- Read/write their own addresses**

**- Read their own orders**

**- Read their own order items through owned orders**

**- Read their own payment state**

**- Upload permitted files to their own storage area**



**A customer cannot:**



**- Read another customer's order**

**- Read another customer's address**

**- Read another customer's payment proof**

**- Assign themselves ADMIN**

**- Verify their own payment**

**- Change authoritative order status**

**- Modify authoritative prices**



**Admins require explicit server-side authorization.**



**Do not rely only on RLS for all application authorization.**



**Use both application checks and database policies appropriately.**



**---**



**# 16. Storage Buckets**



**Recommended conceptual buckets:**



**`product-assets`**



**Public or safely accessible product imagery.**



**`custom-designs`**



**Private customer custom artwork.**



**`payment-proofs`**



**Private payment receipts.**



**Paths should be organized by user/order identifiers.**



**Example:**



**`custom-designs/{userId}/{uuid}.webp`**



**`payment-proofs/{userId}/{uuid}.jpg`**



**Never trust the original uploaded filename as the storage path.**



**Generate safe server-side names.**



**---**



**# 17. Money Rules**



**Never use the customer's submitted price as authoritative.**



**Authoritative pricing comes from store settings/business logic.**



**At order creation:**



**1. Server receives product configuration.**

**2. Server validates product.**

**3. Server validates material.**

**4. Server loads current configured material price.**

**5. Server calculates each line.**

**6. Server calculates subtotal.**

**7. Server loads shipping fee.**

**8. Server calculates total.**

**9. Server writes the complete historical snapshot.**



**All money calculations must happen server-side.**



**---**



**# 18. Deletion Policy**



**Avoid hard-deleting business data used in historical transactions.**



**Prefer:**



**`is\_active = false`**



**for:**



**- Products**

**- Categories**



**Orders, payments, and history should generally remain retained according to business/legal retention requirements.**



**---**



**# 19. Updated Timestamps**



**Create a reusable database trigger/function where appropriate to update:**



**`updated\_at`**



**on relevant tables.**



**---**



**# 20. Seed Data**



**Initial seed data should include:**



**Categories.**



**Example:**



**- iPhone Cases**

**- Custom Cases**

**- Clear Cases**

**- Tough Cases**

**- MagSafe Cases**



**Store settings:**



**- silicone\_price = 150**

**- acrylic\_price = 200**

**- shipping\_fee = 50**

**- currency = EGP**



**Do not seed a production admin password into source control.**



**Admin creation must use a secure documented process.**

