import { expect, test } from "@playwright/test";
import "dotenv/config";

test.describe("customer order flow", () => {
  test("shows Bangla validation errors for an empty form", async ({ page }) => {
    await page.goto("/products/demo-gift-box#order");
    await page.getByRole("button", { name: /অর্ডার কনফার্ম করুন/ }).click();
    await expect(page.getByText("এই তথ্যটি প্রদান করুন।").first()).toBeVisible();
    await page.getByLabel(/মোবাইল নম্বর/).fill("12345");
    await page.getByRole("button", { name: /অর্ডার কনফার্ম করুন/ }).click();
    await expect(page.getByText("সঠিক মোবাইল নম্বর প্রদান করুন।")).toBeVisible();
    await expect(page).toHaveURL(/\/products\/demo-gift-box/);
  });

  test("places an order from the product landing page", async ({ page }) => {
    await page.goto("/products/demo-wall-frame");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ওয়াল ফ্রেম");

    await page.getByRole("link", { name: /^অর্ডার করুন/ }).first().click();
    const order = page.locator("#order");
    await expect(order.getByText("পণ্য নির্বাচন")).toBeVisible();

    await order.getByRole("button", { name: "পরিমাণ বাড়ান" }).first().click();
    await page.getByLabel(/আপনার নাম/).fill("E2E টেস্ট কাস্টমার");
    // A fresh number per run (the store limits orders per phone), typed in Bangla digits.
    const phone = `017${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    await page.getByLabel(/মোবাইল নম্বর/).fill(phone.replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!));
    await page.getByLabel(/^বিভাগ/).selectOption("dhaka");
    await page.getByLabel(/^জেলা/).selectOption("dhaka");
    await page.getByLabel(/এলাকা \/ থানা/).selectOption("dhaka-city-dhanmondi");
    await page.getByLabel(/সম্পূর্ণ ঠিকানা/).fill("বাড়ি ১২, রোড ৫, ধানমন্ডি");

    // Server quote shows the delivery zone before submitting.
    await expect(page.getByText("ঢাকা সিটির ভেতরে").first()).toBeVisible();

    const submit = page.getByRole("button", { name: /অর্ডার কনফার্ম করুন/ });
    await submit.dblclick(); // double click must not create two orders
    await expect(page).toHaveURL(/\/order\/[A-Za-z0-9_-]{20,}/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /অর্ডার সফলভাবে গ্রহণ করা হয়েছে/ })).toBeVisible();
    await expect(page.getByText(/^DBX-\d{8}-\d{4}$/)).toBeVisible();
    await expect(page.getByRole("link", { name: /ফেসবুক পেজে যান/ })).toHaveAttribute("href", /facebook\.com/);
  });
});

test.describe("coupons", () => {
  const bn = (s: string) => s.replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);

  test("a wrong coupon can be removed and the order still goes through", async ({ page }) => {
    await page.goto("/products/demo-gift-box#order");
    await page.getByRole("button", { name: /কুপন কোড আছে/ }).click();
    await page.getByLabel("কুপন কোড").fill("NOPE123");
    await page.getByRole("button", { name: "প্রয়োগ করুন" }).click();
    await expect(page.getByText("কুপন কোডটি সঠিক নয়।")).toBeVisible();

    await page.getByRole("button", { name: "কুপন বাতিল করুন" }).click();
    await expect(page.getByText("কুপন কোডটি সঠিক নয়।")).toBeHidden();

    const phone = `019${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    await page.getByLabel(/আপনার নাম/).fill("E2E কুপন টেস্ট");
    await page.getByLabel(/মোবাইল নম্বর/).fill(bn(phone));
    await page.getByLabel(/^বিভাগ/).selectOption("dhaka");
    await page.getByLabel(/^জেলা/).selectOption("gazipur");
    await page.getByLabel(/এলাকা \/ থানা/).selectOption({ index: 1 });
    await page.getByLabel(/সম্পূর্ণ ঠিকানা/).fill("বাড়ি ৩, রোড ৭, গাজীপুর");
    await expect(page.getByText("ঢাকা সিটির বাইরে").first()).toBeVisible();
    await page.getByRole("button", { name: /অর্ডার কনফার্ম করুন/ }).click();
    await expect(page).toHaveURL(/\/order\/[A-Za-z0-9_-]{20,}/, { timeout: 20_000 });
  });

  test("a valid coupon shows its discount in the summary", async ({ page }) => {
    await page.goto("/products/demo-gift-box#order");
    await page.getByRole("button", { name: /কুপন কোড আছে/ }).click();
    await page.getByLabel("কুপন কোড").fill("demo10");
    await page.getByRole("button", { name: "প্রয়োগ করুন" }).click();
    await expect(page.getByText("কুপন DEMO10 প্রয়োগ হয়েছে")).toBeVisible();
    await expect(page.getByText(/কুপন ছাড় \(DEMO10\)/)).toBeVisible();
  });
});

test.describe("admin", () => {
  test.skip(!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD, "ADMIN_USERNAME / ADMIN_PASSWORD not set");

  test("logs in, finds the latest order and confirms it", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.getByLabel("Username").fill("wrong-user");
    await page.getByLabel("Password").fill("wrong-password-1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid username or password.")).toBeVisible();

    await page.getByLabel("Username").fill(process.env.ADMIN_USERNAME!);
    await page.getByLabel("Password").fill(process.env.ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: /Assalamu alaikum/ })).toBeVisible();

    await page.goto("/admin/orders?q=" + encodeURIComponent("E2E"));
    // The list is a card list on phones and a table from sm up; both are in the DOM, so take the visible one.
    const first = page.locator("a[href^='/admin/orders/']").locator("visible=true").first();
    await expect(first).toBeVisible();
    await first.click();
    await expect(page.getByText("Customer & delivery")).toBeVisible();

    await page.getByLabel("Order status").selectOption("CONFIRMED");
    await page.getByRole("button", { name: "Update" }).click();
    await expect(page.getByText(/Status updated/)).toBeVisible();

    const csv = await page.request.get("/api/orders/export?status=CONFIRMED");
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain("Order Number");
  });
});
