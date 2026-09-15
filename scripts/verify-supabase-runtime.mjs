import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { posix } from "node:path";

import { createClient } from "@supabase/supabase-js";

const requiredEnvironment = [
  "COOLCASE_SUPABASE_URL",
  "COOLCASE_SUPABASE_ANON_KEY",
  "COOLCASE_SUPABASE_SERVICE_ROLE_KEY",
  "COOLCASE_EXPECTED_PROJECT_REF",
];

for (const name of requiredEnvironment) {
  if (!process.env[name]) {
    throw new Error(`Missing required development-test environment variable: ${name}`);
  }
}

const url = process.env.COOLCASE_SUPABASE_URL;
const anonKey = process.env.COOLCASE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.COOLCASE_SUPABASE_SERVICE_ROLE_KEY;
const expectedProjectRef = process.env.COOLCASE_EXPECTED_PROJECT_REF;
const projectHost = new URL(url).hostname;

if (projectHost !== `${expectedProjectRef}.supabase.co`) {
  throw new Error("The Supabase URL does not match the explicitly approved development project ref.");
}

const authOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

const service = createClient(url, serviceRoleKey, authOptions);
const anonymous = createClient(url, anonKey, authOptions);
const runId = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
const checks = [];
const cleanupErrors = [];
const createdUsers = [];
const storageCleanup = new Map();

let categoryId;
let activeProductId;
let inactiveProductId;
let productImageId;
let privateSettingId;

function record(name, detail = "passed") {
  checks.push({ name, detail });
  console.log(`PASS: ${name}${detail === "passed" ? "" : ` — ${detail}`}`);
}

function ensure(condition, name, detail = "passed") {
  if (!condition) {
    throw new Error(`FAILED: ${name}`);
  }

  record(name, detail);
}

function ensureNoError(result, name) {
  if (result.error) {
    throw new Error(`FAILED: ${name}: ${result.error.message}`);
  }

  record(name);
  return result.data;
}

function ensureDenied(result, name) {
  ensure(Boolean(result.error), name);
}

function rememberObject(bucket, path) {
  const paths = storageCleanup.get(bucket) ?? [];
  paths.push(path);
  storageCleanup.set(bucket, paths);
}

async function cleanupStalePhase2bStorage() {
  for (const bucket of ["product-assets", "custom-designs", "payment-proofs"]) {
    const root = await service.storage.from(bucket).list("", { limit: 1000 });
    if (root.error) throw new Error(`Could not inspect ${bucket} for stale test objects: ${root.error.message}`);

    const candidates = [];
    for (const entry of root.data) {
      if (entry.id) {
        candidates.push(entry.name);
        continue;
      }

      const nested = await service.storage.from(bucket).list(entry.name, { limit: 1000 });
      if (nested.error) throw new Error(`Could not inspect ${bucket}/${entry.name}: ${nested.error.message}`);
      for (const item of nested.data) {
        if (item.id) candidates.push(`${entry.name}/${item.name}`);
      }
    }

    const stale = candidates.filter((path) => {
      const filename = path.split("/").at(-1) ?? "";
      return path.startsWith("phase2b/") || /^(phase2b-|leading-|traversal-)/.test(filename);
    });

    if (stale.length > 0) {
      const removal = await service.storage.from(bucket).remove(stale);
      if (removal.error) throw new Error(`Could not remove stale ${bucket} test objects: ${removal.error.message}`);
    }
  }
}

function newAuthedClient(accessToken) {
  return createClient(url, anonKey, {
    ...authOptions,
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

async function createDevelopmentIdentity(label, metadata) {
  const emailLabel = label.toLowerCase().replaceAll("_", "-");
  const email = `coolcase.phase2b.${emailLabel}.${runId}@gmail.com`;
  const password = `${randomBytes(24).toString("base64url")}Aa1!`;
  const userMetadata = {
    full_name: `Phase 2B ${label}`,
    phone: "01000000001",
    governorate: "Cairo",
    city: "Cairo",
    area: "Nasr City",
    street: "Runtime Test Street",
    building: "1",
    ...metadata,
  };
  const signup = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (signup.error || !signup.data.user) {
    throw new Error(`Could not create ${label}: ${signup.error?.message ?? "missing user"}`);
  }

  const id = signup.data.user.id;
  createdUsers.push(id);

  const loginClient = createClient(url, anonKey, authOptions);
  const login = await loginClient.auth.signInWithPassword({ email, password });

  if (login.error || !login.data.session) {
    throw new Error(`Could not authenticate ${label}: ${login.error?.message ?? "missing session"}`);
  }

  return {
    id,
    client: newAuthedClient(login.data.session.access_token),
  };
}

async function verifyProfiles(customerA, customerB, adminTest) {
  const profiles = ensureNoError(
    await service
      .from("profiles")
      .select("id, role")
      .in("id", [customerA.id, customerB.id, adminTest.id]),
    "profile trigger created all three profiles",
  );

  ensure(
    profiles.length === 3 && profiles.every((profile) => profile.role === "CUSTOMER"),
    "normal signup always creates CUSTOMER profiles, including malicious ADMIN metadata",
  );

  ensureNoError(
    await service.from("profiles").update({ role: "ADMIN" }).eq("id", adminTest.id),
    "trusted server operation promoted ADMIN_TEST",
  );

  const promoted = ensureNoError(
    await service.from("profiles").select("role").eq("id", adminTest.id).single(),
    "trusted admin promotion is readable",
  );
  ensure(promoted.role === "ADMIN", "ADMIN_TEST has ADMIN after trusted promotion");

  const ownProfile = ensureNoError(
    await customerA.client.from("profiles").select("id, full_name, email, phone, role").eq("id", customerA.id).single(),
    "CUSTOMER_A can select their own profile",
  );
  ensure(ownProfile.id === customerA.id, "own-profile result belongs to CUSTOMER_A");

  const otherProfile = ensureNoError(
    await customerA.client.from("profiles").select("id, full_name, email, phone, role").eq("id", customerB.id),
    "cross-customer profile query executes under RLS",
  );
  ensure(otherProfile.length === 0, "CUSTOMER_A cannot read CUSTOMER_B profile");

  ensureNoError(
    await customerA.client.from("profiles").update({ full_name: "Phase 2B Customer A" }).eq("id", customerA.id),
    "CUSTOMER_A can update an allowed own-profile field",
  );

  ensureDenied(
    await customerA.client.from("profiles").update({ role: "ADMIN" }).eq("id", customerA.id),
    "CUSTOMER_A cannot promote their own role",
  );
  ensureDenied(
    await customerA.client.from("profiles").update({ role: "ADMIN" }).eq("id", customerB.id),
    "CUSTOMER_A cannot change CUSTOMER_B role",
  );

  const crossUpdate = ensureNoError(
    await customerA.client
      .from("profiles")
      .update({ full_name: "Unauthorized change" })
      .eq("id", customerB.id)
      .select("id"),
    "cross-customer profile update is filtered by RLS",
  );
  ensure(crossUpdate.length === 0, "CUSTOMER_A cannot update CUSTOMER_B profile");
}

async function verifyAddresses(customerA, customerB) {
  const commonAddress = {
    recipient_name: "Phase 2B Recipient",
    phone: "01000000001",
    governorate: "Cairo",
    city_area: "Nasr City",
    street_name: "Runtime Test Street",
    building_number: "1",
  };

  const addressA = ensureNoError(
    await customerA.client.from("addresses").select("id, user_id, label, is_default").eq("user_id", customerA.id).single(),
    "signup trigger created CUSTOMER_A default address",
  );
  const addressB = ensureNoError(
    await customerB.client.from("addresses").select("id, user_id, is_default").eq("user_id", customerB.id).single(),
    "signup trigger created CUSTOMER_B default address",
  );
  ensure(addressA.is_default && addressB.is_default, "signup addresses are default addresses");

  const ownRead = ensureNoError(
    await customerA.client.from("addresses").select("id").eq("id", addressA.id),
    "CUSTOMER_A can select their own address",
  );
  ensure(ownRead.length === 1, "own address is visible to CUSTOMER_A");

  const crossRead = ensureNoError(
    await customerA.client.from("addresses").select("id").eq("id", addressB.id),
    "cross-customer address query executes under RLS",
  );
  ensure(crossRead.length === 0, "CUSTOMER_A cannot read CUSTOMER_B address");

  ensureDenied(
    await customerA.client.from("addresses").insert({ ...commonAddress, user_id: customerB.id, label: "Forbidden" }),
    "CUSTOMER_A cannot insert an address owned by CUSTOMER_B",
  );

  const crossUpdate = ensureNoError(
    await customerA.client.from("addresses").update({ label: "Forbidden" }).eq("id", addressB.id).select("id"),
    "cross-customer address update is filtered by RLS",
  );
  ensure(crossUpdate.length === 0, "CUSTOMER_A cannot update CUSTOMER_B address");

  const crossDelete = ensureNoError(
    await customerA.client.from("addresses").delete().eq("id", addressB.id).select("id"),
    "cross-customer address delete is filtered by RLS",
  );
  ensure(crossDelete.length === 0, "CUSTOMER_A cannot delete CUSTOMER_B address");

  ensureDenied(
    await customerA.client.from("addresses").insert({
      ...commonAddress,
      user_id: customerA.id,
      label: "Second default",
      is_default: true,
    }),
    "database prevents two default addresses for one customer",
  );

  const editableAddress = ensureNoError(
    await customerA.client
      .from("addresses")
      .insert({ ...commonAddress, user_id: customerA.id, label: "Editable", is_default: false })
      .select("id")
      .single(),
    "CUSTOMER_A can insert a second non-default address",
  );
  ensureNoError(
    await customerA.client.from("addresses").update({ label: "Updated" }).eq("id", editableAddress.id),
    "CUSTOMER_A can update their own address",
  );
  ensureNoError(
    await customerA.client.rpc("set_default_address", { target_address_id: editableAddress.id }),
    "CUSTOMER_A can atomically change their default address",
  );
  const defaultRows = ensureNoError(
    await customerA.client.from("addresses").select("id, is_default").eq("user_id", customerA.id),
    "CUSTOMER_A can inspect addresses after changing the default",
  );
  ensure(
    defaultRows.filter((address) => address.is_default).length === 1
      && defaultRows.find((address) => address.is_default)?.id === editableAddress.id,
    "exactly one CUSTOMER_A address remains default",
  );
  ensureDenied(
    await customerA.client.rpc("set_default_address", { target_address_id: addressB.id }),
    "CUSTOMER_A cannot make CUSTOMER_B address the default",
  );
  ensureNoError(
    await customerA.client.from("addresses").delete().eq("id", addressA.id),
    "CUSTOMER_A can delete their own address",
  );
}

async function verifyCatalogAndSettings(customerA, adminTest) {
  const category = ensureNoError(
    await adminTest.client
      .from("categories")
      .insert({ name: `Phase 2B ${runId}`, slug: `phase-2b-${runId}`, display_order: 999 })
      .select("id")
      .single(),
    "authenticated administrator can create temporary catalog data",
  );
  categoryId = category.id;

  const activeProduct = ensureNoError(
    await adminTest.client
      .from("products")
      .insert({ category_id: categoryId, name: `Phase 2B Active ${runId}`, slug: `phase-2b-active-${runId}`, is_active: true })
      .select("id")
      .single(),
    "administrator can create an active product",
  );
  activeProductId = activeProduct.id;

  const inactiveProduct = ensureNoError(
    await adminTest.client
      .from("products")
      .insert({ category_id: categoryId, name: `Phase 2B Inactive ${runId}`, slug: `phase-2b-inactive-${runId}`, is_active: false })
      .select("id")
      .single(),
    "administrator can create an inactive product",
  );
  inactiveProductId = inactiveProduct.id;

  const productImage = ensureNoError(
    await adminTest.client
      .from("product_images")
      .insert({
        product_id: activeProductId,
        storage_path: `phase2b/${runId}.png`,
        original_storage_path: `private-source/${runId}.png`,
        processed_storage_path: `phase2b/${runId}.png`,
        is_primary: true,
      })
      .select("id")
      .single(),
    "administrator can create temporary product image metadata",
  );
  productImageId = productImage.id;

  const publicCategories = ensureNoError(
    await anonymous.from("categories").select("id, slug, is_active").eq("id", categoryId),
    "anonymous catalog category read succeeds",
  );
  ensure(publicCategories.length === 1, "anonymous user can read active categories");

  const publicActive = ensureNoError(
    await anonymous.from("products").select("id, slug, is_active").eq("id", activeProductId),
    "anonymous active-product read succeeds",
  );
  ensure(publicActive.length === 1, "anonymous user can read active products");

  const publicInactive = ensureNoError(
    await anonymous.from("products").select("id").eq("id", inactiveProductId),
    "anonymous inactive-product query executes under RLS",
  );
  ensure(publicInactive.length === 0, "anonymous user cannot read inactive products");

  const safeImage = ensureNoError(
    await anonymous
      .from("product_images")
      .select("id, product_id, storage_path, processed_storage_path, alt_text, display_order, is_primary, created_at")
      .eq("id", productImageId),
    "anonymous user can read allowed product-image fields",
  );
  ensure(safeImage.length === 1, "active product image is publicly visible");
  ensureDenied(
    await anonymous.from("product_images").select("original_storage_path").eq("id", productImageId),
    "anonymous user cannot select original_storage_path",
  );
  ensureDenied(
    await customerA.client.from("product_images").select("original_storage_path").eq("id", productImageId),
    "customer cannot select original_storage_path",
  );

  ensureDenied(
    await customerA.client.from("products").insert({ name: "Forbidden", slug: `forbidden-${runId}` }),
    "customer cannot insert products",
  );
  const priceMutation = ensureNoError(
    await customerA.client
      .from("products")
      .update({ silicone_price_override: 1 })
      .eq("id", activeProductId)
      .select("id"),
    "customer product-price mutation is filtered by RLS",
  );
  ensure(priceMutation.length === 0, "customer cannot modify product price overrides");
  const disableMutation = ensureNoError(
    await customerA.client.from("products").update({ is_active: false }).eq("id", activeProductId).select("id"),
    "customer product-disable mutation is filtered by RLS",
  );
  ensure(disableMutation.length === 0, "customer cannot disable products");
  const categoryMutation = ensureNoError(
    await customerA.client.from("categories").update({ name: "Forbidden" }).eq("id", categoryId).select("id"),
    "customer category mutation is filtered by RLS",
  );
  ensure(categoryMutation.length === 0, "customer cannot modify categories");

  const privateSetting = ensureNoError(
    await service
      .from("store_settings")
      .insert({ key: `phase2b_private_${runId}`, value: { internal: true }, is_public: false })
      .select("id")
      .single(),
    "trusted operation created a temporary private setting",
  );
  privateSettingId = privateSetting.id;

  const publicSettings = ensureNoError(
    await anonymous.from("store_settings").select("id, key, value, is_public, updated_at"),
    "anonymous safe-column settings read succeeds",
  );
  ensure(publicSettings.every((setting) => setting.is_public), "anonymous user sees only public settings");
  ensure(!publicSettings.some((setting) => setting.id === privateSettingId), "private setting is hidden from anonymous users");
  ensureDenied(
    await anonymous.from("store_settings").select("updated_by"),
    "anonymous user cannot select settings updated_by",
  );

  const customerSettingMutation = ensureNoError(
    await customerA.client.from("store_settings").update({ value: 1 }).eq("key", "silicone_price").select("id"),
    "customer settings mutation is filtered by RLS",
  );
  ensure(customerSettingMutation.length === 0, "customer cannot mutate store settings");

  ensureDenied(
    await service.from("store_settings").update({ value: 1.5 }).eq("key", "silicone_price"),
    "fractional authoritative price is rejected",
  );
  ensureDenied(
    await service.from("store_settings").update({ value: -1 }).eq("key", "silicone_price"),
    "negative authoritative price is rejected",
  );
  ensureDenied(
    await service.from("store_settings").update({ value: "egp" }).eq("key", "currency"),
    "invalid currency format is rejected",
  );

  const authoritativeSettings = ensureNoError(
    await service.from("store_settings").select("key, value").in("key", ["silicone_price", "currency"]),
    "authoritative settings remain readable after rejected mutations",
  );
  const silicone = authoritativeSettings.find((setting) => setting.key === "silicone_price");
  const currency = authoritativeSettings.find((setting) => setting.key === "currency");
  ensure(silicone?.value === 150 && currency?.value === "EGP", "rejected mutations left approved settings unchanged");
}

async function verifyStorage(customerA, customerB, adminTest) {
  const buckets = ensureNoError(await service.storage.listBuckets(), "trusted client can inspect storage buckets");
  const productBucket = buckets.find((bucket) => bucket.id === "product-assets");
  const designBucket = buckets.find((bucket) => bucket.id === "custom-designs");
  const proofBucket = buckets.find((bucket) => bucket.id === "payment-proofs");
  ensure(Boolean(productBucket && designBucket && proofBucket), "all three required storage buckets exist");
  ensure(productBucket.public === true, "product-assets bucket is public");
  ensure(designBucket.public === false && proofBucket.public === false, "customer upload buckets are private");

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const samples = [
    ["jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xd9])],
    ["png", "image/png", png],
    ["webp", "image/webp", Buffer.from("RIFF0000WEBP", "ascii")],
    ["avif", "image/avif", Buffer.from("00000020ftypavif", "ascii")],
  ];

  const productPath = `phase2b/${runId}.png`;
  ensureNoError(
    await adminTest.client.storage.from("product-assets").upload(productPath, png, { contentType: "image/png", upsert: false }),
    "administrator can upload product assets",
  );
  rememberObject("product-assets", productPath);
  ensureNoError(
    await anonymous.storage.from("product-assets").download(productPath),
    "anonymous user can read public product assets",
  );
  ensureDenied(
    await customerA.client.storage.from("product-assets").upload(`phase2b/customer-${runId}.png`, png, { contentType: "image/png" }),
    "customer cannot upload product assets",
  );
  ensureDenied(
    await customerA.client.storage.from("product-assets").update(productPath, png, { contentType: "image/png" }),
    "customer cannot overwrite product assets",
  );
  const productDeleteAttempt = ensureNoError(
    await customerA.client.storage.from("product-assets").remove([productPath]),
    "customer product-asset delete request is safely filtered",
  );
  ensure(productDeleteAttempt.length === 0, "customer cannot delete product assets");
  ensureNoError(
    await anonymous.storage.from("product-assets").download(productPath),
    "product asset remains readable after unauthorized delete attempt",
  );

  for (const [extension, contentType, bytes] of samples) {
    const path = `${customerA.id}/phase2b-${runId}.${extension}`;
    ensureNoError(
      await customerA.client.storage.from("custom-designs").upload(path, bytes, { contentType, upsert: false }),
      `CUSTOMER_A can upload allowed ${contentType} custom design`,
    );
    rememberObject("custom-designs", path);
  }

  const ownDesignPath = `${customerA.id}/phase2b-${runId}.png`;
  ensureNoError(
    await customerA.client.storage.from("custom-designs").download(ownDesignPath),
    "CUSTOMER_A can read their own custom design",
  );
  ensureDenied(
    await customerB.client.storage.from("custom-designs").download(ownDesignPath),
    "CUSTOMER_B cannot read CUSTOMER_A custom design",
  );
  ensureDenied(
    await customerA.client.storage
      .from("custom-designs")
      .upload(`${customerB.id}/forbidden-${runId}.png`, png, { contentType: "image/png" }),
    "CUSTOMER_A cannot upload under CUSTOMER_B UUID path",
  );
  for (const malformedPath of [
    `/${customerA.id}/leading-${runId}.png`,
    `${customerB.id}/../${customerA.id}/traversal-${runId}.png`,
  ]) {
    const attempt = await customerA.client.storage
      .from("custom-designs")
      .upload(malformedPath, png, { contentType: "image/png", upsert: false });

    if (attempt.error) {
      record("malformed custom-design path is rejected without an ownership bypass");
      continue;
    }

    const returnedPath = attempt.data.path.replace(/^custom-designs\//, "");
    const canonicalPath = posix.normalize(returnedPath).replace(/^\/+/, "");
    ensure(
      canonicalPath.startsWith(`${customerA.id}/`),
      "accepted malformed path is canonicalized only into CUSTOMER_A ownership",
    );
    rememberObject("custom-designs", canonicalPath);
    ensureDenied(
      await customerB.client.storage.from("custom-designs").download(returnedPath),
      "submitted malformed path remains unreadable to CUSTOMER_B",
    );
    ensureDenied(
      await customerB.client.storage.from("custom-designs").download(canonicalPath),
      "normalized malformed path remains unreadable to CUSTOMER_B",
    );
  }
  ensureDenied(
    await customerA.client.storage.from("custom-designs").update(ownDesignPath, png, { contentType: "image/png" }),
    "customer cannot overwrite existing custom-design evidence",
  );
  const designDeleteAttempt = ensureNoError(
    await customerA.client.storage.from("custom-designs").remove([ownDesignPath]),
    "customer custom-design delete request is safely filtered",
  );
  ensure(designDeleteAttempt.length === 0, "customer cannot delete custom-design evidence");
  ensureNoError(
    await customerA.client.storage.from("custom-designs").download(ownDesignPath),
    "custom design remains readable after unauthorized delete attempt",
  );
  ensureDenied(
    await customerA.client.storage
      .from("custom-designs")
      .upload(`${customerA.id}/phase2b-${runId}.svg`, Buffer.from("<svg></svg>"), { contentType: "image/svg+xml" }),
    "SVG custom design is rejected by bucket restrictions",
  );

  const proofPath = `${customerA.id}/phase2b-proof-${runId}.png`;
  ensureNoError(
    await customerA.client.storage.from("payment-proofs").upload(proofPath, png, { contentType: "image/png", upsert: false }),
    "CUSTOMER_A can upload their own payment proof",
  );
  rememberObject("payment-proofs", proofPath);
  ensureNoError(
    await customerA.client.storage.from("payment-proofs").download(proofPath),
    "CUSTOMER_A can read their own payment proof",
  );
  ensureDenied(
    await customerB.client.storage.from("payment-proofs").download(proofPath),
    "CUSTOMER_B cannot read CUSTOMER_A payment proof",
  );
  ensureDenied(
    await customerA.client.storage
      .from("payment-proofs")
      .upload(`${customerB.id}/forbidden-proof-${runId}.png`, png, { contentType: "image/png" }),
    "CUSTOMER_A cannot upload a proof under CUSTOMER_B path",
  );
  ensureDenied(
    await customerA.client.storage.from("payment-proofs").update(proofPath, png, { contentType: "image/png" }),
    "customer cannot overwrite an existing payment proof",
  );
  const proofDeleteAttempt = ensureNoError(
    await customerA.client.storage.from("payment-proofs").remove([proofPath]),
    "customer payment-proof delete request is safely filtered",
  );
  ensure(proofDeleteAttempt.length === 0, "customer cannot delete payment proof evidence");
  ensureNoError(
    await customerA.client.storage.from("payment-proofs").download(proofPath),
    "payment proof remains readable after unauthorized delete attempt",
  );
  ensureNoError(
    await adminTest.client.storage.from("payment-proofs").download(proofPath),
    "administrator can review a private payment proof",
  );

  const allowedMimes = new Set(designBucket.allowed_mime_types ?? designBucket.allowedMimeTypes ?? []);
  ensure(
    samples.every(([, contentType]) => allowedMimes.has(contentType)),
    "bucket metadata includes JPEG, PNG, WebP, and AVIF allow-list",
  );
  ensure(!allowedMimes.has("image/svg+xml"), "bucket metadata excludes SVG");
  const bucketLimit = designBucket.file_size_limit ?? designBucket.fileSizeLimit ?? null;
  record("bucket-specific upload size limit inspected", bucketLimit === null ? "inherits hosted global limit" : String(bucketLimit));
}

function runDatabaseTests(customerA, customerB, adminTest) {
  const command = process.platform === "win32" ? "cmd.exe" : "npx";
  const commandArguments =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npx --yes supabase@2 db query --linked --file supabase\\tests\\database_runtime.test.sql"]
      : ["--yes", "supabase@2", "db", "query", "--linked", "--file", "supabase/tests/database_runtime.test.sql"];
  const result = spawnSync(
    command,
    commandArguments,
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        COOLCASE_TEST_CUSTOMER_A_ID: customerA.id,
        COOLCASE_TEST_CUSTOMER_B_ID: customerB.id,
        COOLCASE_TEST_ADMIN_ID: adminTest.id,
        COOLCASE_TEST_RUN_ID: runId,
      },
      stdio: "inherit",
    },
  );

  if (result.error) throw result.error;
  ensure(result.status === 0, "linked SQL constraint, commerce, payment, tracking, and audit suite passed");
}

async function cleanup() {
  for (const [bucket, paths] of storageCleanup) {
    const result = await service.storage.from(bucket).remove(paths);
    if (result.error) {
      cleanupErrors.push(`${bucket}: ${result.error.message}`);
    }
  }

  if (productImageId) {
    const result = await service.from("product_images").delete().eq("id", productImageId);
    if (result.error) cleanupErrors.push(`product_images: ${result.error.message}`);
  }
  if (activeProductId || inactiveProductId) {
    const ids = [activeProductId, inactiveProductId].filter(Boolean);
    const result = await service.from("products").delete().in("id", ids);
    if (result.error) cleanupErrors.push(`products: ${result.error.message}`);
  }
  if (categoryId) {
    const result = await service.from("categories").delete().eq("id", categoryId);
    if (result.error) cleanupErrors.push(`categories: ${result.error.message}`);
  }
  if (privateSettingId) {
    const result = await service.from("store_settings").delete().eq("id", privateSettingId);
    if (result.error) cleanupErrors.push(`store_settings: ${result.error.message}`);
  }

  for (const userId of createdUsers.reverse()) {
    const result = await service.auth.admin.deleteUser(userId);
    if (result.error) cleanupErrors.push(`auth user cleanup: ${result.error.message}`);
  }
}

let failed;

try {
  await cleanupStalePhase2bStorage();
  record("stale Phase 2B storage objects from interrupted runs were removed");
  const customerA = await createDevelopmentIdentity("CUSTOMER_A", {
    full_name: "Phase 2B Customer A",
    role: "ADMIN",
  });
  const customerB = await createDevelopmentIdentity("CUSTOMER_B", {
    full_name: "Phase 2B Customer B",
  });
  const adminTest = await createDevelopmentIdentity("ADMIN_TEST", {
    full_name: "Phase 2B Admin Test",
  });

  record("three temporary confirmed identities were created through Supabase Auth admin test setup");
  await verifyProfiles(customerA, customerB, adminTest);
  await verifyAddresses(customerA, customerB);
  await verifyCatalogAndSettings(customerA, adminTest);
  await verifyStorage(customerA, customerB, adminTest);
  runDatabaseTests(customerA, customerB, adminTest);
} catch (error) {
  failed = error;
} finally {
  await cleanup();
}

if (cleanupErrors.length > 0) {
  console.error("Cleanup failures:");
  for (const error of cleanupErrors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  record("temporary storage, catalog, settings, addresses, profiles, and auth users were removed");
}

if (failed) {
  throw failed;
}

console.log(`Runtime verification completed with ${checks.length} passing checks.`);
