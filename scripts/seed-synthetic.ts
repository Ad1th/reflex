// Generates a synthetic reflex library for ~40 fictional flows (never the booking flow) so Moss
// searches a realistically large index. Usage: pnpm exec tsx scripts/seed-synthetic.ts [N=20000]
import fs from "node:fs";
import path from "node:path";
import type { Action, PageElement, PageState, Reflex } from "../src/lib/types";
import { flowKey, signature, stateKey } from "../src/lib/templating";
import { DIM, embedBatch } from "../src/server/embedder";

const N = Number(process.argv[2] ?? 20000);
const OUT = path.join(process.cwd(), "data");

// Tiny seeded PRNG so reruns are reproducible.
let seed = 1337;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

/** Page DSL: "route|Heading|field;field;..." field = t:Label:slot | a:Label:slot | s:Label:slot | c:Label | b:Button | l:Link */
interface FlowDef { app: string; intent: string; pages: string[] }

const FLOWS: FlowDef[] = [
  { app: "Spendly", intent: "submit_expense", pages: [
    "/expenses|Expenses|b:New expense;l:Reports;l:Approvals",
    "/expenses/new|New expense|t:Merchant:merchant;t:Amount:amount;s:Currency:currency;s:Category:category;t:Date:date;a:Description:notes;b:Attach receipt;b:Save draft;b:Submit",
    "/expenses/review|Review expense|c:I confirm this expense is business related;b:Back;b:Submit for approval",
    "/expenses/done|Expense submitted|l:View expense;b:New expense"] },
  { app: "Spendly", intent: "approve_expense", pages: [
    "/approvals|Pending approvals|t:Search employee:employee;s:Status:status;b:Filter",
    "/approvals/item|Expense from {employee}|a:Comment:notes;b:Approve;b:Reject;b:Request changes",
    "/approvals/done|Approval recorded|l:Back to approvals"] },
  { app: "PipeCRM", intent: "update_deal", pages: [
    "/deals|Deals|t:Search deals:deal;s:Pipeline:pipeline;b:New deal",
    "/deals/edit|Edit deal|t:Deal name:deal;t:Value:amount;s:Stage:stage;t:Close date:date;s:Owner:owner;a:Notes:notes;b:Cancel;b:Save deal",
    "/deals/saved|Deal updated|l:Back to deals;b:Log activity"] },
  { app: "PipeCRM", intent: "add_contact", pages: [
    "/contacts|Contacts|b:Add contact;t:Search contacts:name",
    "/contacts/new|New contact|t:First name:first_name;t:Last name:last_name;t:Email:email;t:Phone:phone;t:Company:company;s:Lifecycle stage:stage;b:Create contact",
    "/contacts/created|Contact created|l:View contact;b:Add another"] },
  { app: "PipeCRM", intent: "log_call", pages: [
    "/contacts/view|{name}|b:Log call;b:Send email;b:Add task",
    "/activity/call|Log a call|s:Outcome:outcome;t:Duration (minutes):duration;a:Call notes:notes;c:Create follow-up task;b:Save call"] },
  { app: "Triagely", intent: "triage_ticket", pages: [
    "/inbox|Support inbox|t:Search tickets:ticket;s:Queue:queue;b:Refresh",
    "/tickets/view|Ticket {ticket}|s:Priority:priority;s:Assignee:assignee;s:Status:status;t:Tags:tags;a:Internal note:notes;b:Update ticket",
    "/tickets/updated|Ticket updated|l:Next ticket;l:Back to inbox"] },
  { app: "Triagely", intent: "reply_ticket", pages: [
    "/tickets/view|Ticket {ticket}|b:Reply;b:Forward;b:Merge",
    "/tickets/reply|Reply to customer|s:Template:template;a:Message:message;c:Mark as solved after sending;b:Send reply"] },
  { app: "Wanderly", intent: "book_flight", pages: [
    "/flights|Search flights|t:From:origin;t:To:destination;t:Depart:date;t:Return:return_date;s:Passengers:passengers;s:Cabin:cabin;b:Search flights",
    "/flights/results|Flights to {destination}|s:Sort by:sort;c:Nonstop only;b:Select;b:Select;b:Select",
    "/flights/passenger|Passenger details|t:Full name:name;t:Email:email;t:Passport number:passport;s:Nationality:nationality;b:Continue to payment",
    "/flights/pay|Payment|t:Card number:card;t:Expiry:expiry;t:CVC:cvc;c:I accept the fare rules;b:Pay now",
    "/flights/confirmed|Trip confirmed|l:Download itinerary"] },
  { app: "Wanderly", intent: "book_hotel", pages: [
    "/hotels|Find a stay|t:Destination:city;t:Check-in:checkin;t:Check-out:checkout;s:Guests:guests;b:Search",
    "/hotels/results|Stays in {city}|s:Sort by:sort;c:Free cancellation;b:View rooms;b:View rooms",
    "/hotels/room|Choose your room|s:Room type:room;s:Bed preference:bed;b:Reserve",
    "/hotels/guest|Guest details|t:Full name:name;t:Email:email;a:Special requests:notes;b:Complete booking"] },
  { app: "Wanderly", intent: "rent_car", pages: [
    "/cars|Rent a car|t:Pick-up location:city;t:Pick-up date:date;t:Drop-off date:return_date;s:Driver age:age;b:Find cars",
    "/cars/results|Cars in {city}|s:Car type:car;b:Choose;b:Choose",
    "/cars/extras|Extras|c:Full insurance;c:GPS;c:Child seat;b:Continue",
    "/cars/driver|Driver details|t:Full name:name;t:License number:license;b:Confirm rental"] },
  { app: "Payroll+", intent: "request_time_off", pages: [
    "/timeoff|Time off|b:Request time off;l:Balances;l:Holidays",
    "/timeoff/new|Request time off|s:Type:type;t:Start date:start_date;t:End date:end_date;a:Reason:notes;s:Approver:approver;b:Submit request"] },
  { app: "Payroll+", intent: "update_bank_details", pages: [
    "/profile/pay|Payment details|b:Edit bank account",
    "/profile/pay/edit|Bank account|t:Account holder:name;t:IBAN:iban;t:BIC:bic;c:Use for reimbursements;b:Save",
    "/profile/pay/verify|Verify change|t:Verification code:code;b:Verify"] },
  { app: "HireDesk", intent: "schedule_interview", pages: [
    "/candidates|Candidates|t:Search candidates:candidate;s:Job:job;b:Search",
    "/candidates/view|{candidate}|b:Schedule interview;b:Move stage;b:Reject",
    "/interviews/new|Schedule interview|s:Interview type:type;s:Interviewer:interviewer;t:Date:date;t:Time:time;s:Duration:duration;c:Send calendar invite;b:Schedule"] },
  { app: "HireDesk", intent: "post_job", pages: [
    "/jobs/new|Create job|t:Job title:title;s:Department:department;s:Location:location;s:Employment type:employment;t:Salary range:salary;a:Description:description;b:Publish job"] },
  { app: "ShipTrack", intent: "create_shipment", pages: [
    "/shipments|Shipments|b:Create shipment",
    "/shipments/new|Ship to|t:Recipient name:name;t:Address line 1:address;t:City:city;t:Postal code:zip;s:Country:country;b:Next",
    "/shipments/package|Package|t:Weight (kg):weight;t:Length (cm):length;t:Width (cm):width;t:Height (cm):height;s:Service:service;b:Get rates",
    "/shipments/label|Label ready|b:Print label;l:Track shipment"] },
  { app: "ShipTrack", intent: "return_order", pages: [
    "/orders|Your orders|t:Order number:order;b:Find order",
    "/returns/new|Return items|c:Item 1;c:Item 2;s:Return reason:reason;a:Comments:notes;s:Refund method:refund;b:Request return"] },
  { app: "Shoply", intent: "checkout_cart", pages: [
    "/cart|Your cart|t:Promo code:promo;b:Apply;b:Checkout",
    "/checkout/shipping|Shipping|t:Full name:name;t:Street:address;t:City:city;t:ZIP:zip;s:State:state;b:Continue to payment",
    "/checkout/payment|Payment|t:Card number:card;t:Name on card:name;t:Expiry:expiry;b:Place order",
    "/checkout/done|Order placed|l:Continue shopping"] },
  { app: "Shoply", intent: "write_review", pages: [
    "/products/view|{product}|b:Write a review;b:Add to cart",
    "/reviews/new|Review {product}|s:Rating:rating;t:Title:title;a:Review:review;c:Recommend this product;b:Post review"] },
  { app: "Clinicly", intent: "book_appointment_doctor", pages: [
    "/doctors|Find a doctor|t:Specialty:specialty;t:Near:city;b:Search",
    "/doctors/view|Dr. {doctor}|s:Available slots:slot;b:Book visit",
    "/visit/details|Patient information|t:Patient name:name;t:Date of birth:dob;t:Insurance ID:insurance;a:Symptoms:notes;b:Confirm visit"] },
  { app: "Clinicly", intent: "refill_prescription", pages: [
    "/rx|Prescriptions|b:Request refill",
    "/rx/refill|Request refill|s:Medication:medication;s:Pharmacy:pharmacy;c:Deliver to home;b:Send request"] },
  { app: "Leasely", intent: "submit_maintenance", pages: [
    "/requests/new|Maintenance request|s:Category:category;s:Location in unit:room;a:Describe the issue:notes;c:Permission to enter;t:Best time to call:time;b:Submit request"] },
  { app: "Leasely", intent: "pay_rent", pages: [
    "/payments|Payments|b:Pay rent;l:History",
    "/payments/new|Pay rent|t:Amount:amount;s:Pay from:account;t:Payment date:date;b:Review payment",
    "/payments/review|Review payment|c:I authorize this payment;b:Pay"] },
  { app: "EventHub", intent: "register_event", pages: [
    "/events/view|{event}|b:Register;l:Agenda;l:Speakers",
    "/events/register|Registration|t:Full name:name;t:Work email:email;t:Company:company;t:Job title:title;s:Ticket type:ticket;c:Subscribe to updates;b:Register"] },
  { app: "EventHub", intent: "create_event", pages: [
    "/events/new|Create event|t:Event name:event;t:Date:date;t:Start time:time;t:Venue:venue;t:Capacity:capacity;a:Description:description;b:Create event"] },
  { app: "Taskboard", intent: "create_task", pages: [
    "/board|Sprint board|b:New task;s:Filter by assignee:assignee",
    "/tasks/new|New task|t:Title:title;s:Assignee:assignee;s:Priority:priority;t:Due date:date;t:Estimate:estimate;a:Description:description;b:Create task"] },
  { app: "Taskboard", intent: "file_bug", pages: [
    "/bugs/new|Report a bug|t:Summary:title;s:Component:component;s:Severity:severity;a:Steps to reproduce:steps;a:Expected result:expected;t:Browser:browser;b:File bug"] },
  { app: "Invoicer", intent: "create_invoice", pages: [
    "/invoices|Invoices|b:New invoice",
    "/invoices/new|New invoice|s:Customer:customer;t:Invoice date:date;t:Due date:due_date;t:Line item:item;t:Quantity:qty;t:Unit price:amount;s:Tax rate:tax;b:Preview",
    "/invoices/preview|Invoice preview|b:Edit;b:Send invoice"] },
  { app: "Invoicer", intent: "record_payment", pages: [
    "/invoices/view|Invoice {invoice}|b:Record payment;b:Send reminder",
    "/payments/record|Record payment|t:Amount received:amount;t:Payment date:date;s:Method:method;t:Reference:reference;b:Save payment"] },
  { app: "Learnly", intent: "enroll_course", pages: [
    "/courses|Course catalog|t:Search courses:course;s:Level:level;b:Search",
    "/courses/view|{course}|b:Enroll;l:Syllabus",
    "/enroll|Enrollment|s:Cohort start:date;s:Payment plan:plan;c:I agree to the terms;b:Confirm enrollment"] },
  { app: "Fleetio", intent: "log_fuel", pages: [
    "/vehicles/view|Vehicle {vehicle}|b:Log fuel;b:Log service",
    "/fuel/new|Fuel entry|t:Odometer:odometer;t:Liters:liters;t:Price per liter:price;t:Station:station;c:Full tank;b:Save entry"] },
  { app: "Grantly", intent: "apply_grant", pages: [
    "/grants/apply|Applicant|t:Organization name:org;t:Tax ID:tax_id;t:Contact email:email;b:Next",
    "/grants/project|Project|t:Project title:title;t:Requested amount:amount;a:Summary:summary;b:Next",
    "/grants/review|Review application|c:I certify the information is accurate;b:Submit application"] },
  { app: "Volunteer", intent: "signup_shift", pages: [
    "/shifts|Open shifts|s:Location:location;t:Date:date;b:Show shifts",
    "/shifts/signup|Sign up|t:Name:name;t:Phone:phone;s:Shift:shift;c:First time volunteering;b:Sign up"] },
  { app: "CloudOps", intent: "create_vm", pages: [
    "/compute/new|Create instance|t:Instance name:name;s:Region:region;s:Machine type:machine;s:Image:image;t:Disk size (GB):disk;c:Allow HTTPS traffic;b:Create"] },
  { app: "CloudOps", intent: "invite_member", pages: [
    "/iam|Members|b:Invite member",
    "/iam/invite|Invite member|t:Email:email;s:Role:role;s:Team:team;a:Message:notes;b:Send invite"] },
  { app: "Mailbird", intent: "create_campaign", pages: [
    "/campaigns/new|New campaign|t:Campaign name:name;s:Audience:audience;t:Subject line:subject;t:From name:sender;b:Design email",
    "/campaigns/schedule|Schedule|t:Send date:date;t:Send time:time;s:Time zone:tz;b:Schedule campaign"] },
  { app: "Restaurante", intent: "reserve_table", pages: [
    "/reserve|Reserve a table|s:Party size:party;t:Date:date;s:Time:time;b:Find a table",
    "/reserve/details|Your details|t:Name:name;t:Phone:phone;s:Occasion:occasion;a:Requests:notes;b:Confirm reservation"] },
  { app: "Gymly", intent: "book_class", pages: [
    "/classes|Class schedule|s:Studio:studio;s:Day:day;b:Filter",
    "/classes/view|{class_name}|b:Book spot;b:Join waitlist",
    "/classes/confirm|Confirm booking|c:Use class credit;b:Confirm"] },
  { app: "Insurely", intent: "file_claim", pages: [
    "/claims/new|File a claim|s:Policy:policy;t:Date of incident:date;s:Claim type:claim_type;a:What happened:notes;b:Continue",
    "/claims/docs|Documents|b:Upload photos;b:Upload police report;b:Submit claim"] },
  { app: "Permitly", intent: "apply_permit", pages: [
    "/permits/new|Permit application|s:Permit type:permit;t:Property address:address;t:Parcel number:parcel;t:Applicant name:name;t:Phone:phone;a:Scope of work:notes;b:Submit"] },
  { app: "Subscribo", intent: "cancel_subscription", pages: [
    "/account/billing|Billing|b:Change plan;b:Cancel subscription",
    "/account/cancel|Cancel subscription|s:Reason:reason;a:Feedback:notes;c:I understand my data will be deleted;b:Cancel subscription;b:Keep subscription"] },
  { app: "Donately", intent: "make_donation", pages: [
    "/donate|Make a donation|s:Fund:fund;t:Amount:amount;c:Make this monthly;t:Name:name;t:Email:email;b:Donate"] },
];

const CHROME: Record<string, string[]> = {};
const chromeFor = (app: string) =>
  (CHROME[app] ??= ["Home", "Dashboard", "Settings", "Help", "Notifications", "Profile", "Search"].filter(() => rnd() < 0.5));

const ROLE: Record<string, PageElement["role"]> = { t: "textbox", a: "textarea", s: "select", c: "checkbox", b: "button", l: "link" };

interface Field { role: PageElement["role"]; label: string; slot?: string }
const parsePage = (spec: string) => {
  const [route, heading, fields] = spec.split("|");
  return {
    route,
    heading,
    fields: fields.split(";").map((f): Field => {
      const [k, label, slot] = f.split(":");
      return { role: ROLE[k], label, slot };
    }),
  };
};

const flows = FLOWS.map((f) => {
  const pages = f.pages.map(parsePage);
  const slotNames = new Set<string>();
  for (const p of pages) for (const fl of p.fields) if (fl.slot) slotNames.add(fl.slot);
  for (const p of pages) for (const m of p.heading.matchAll(/\{(\w+)\}/g)) slotNames.add(m[1]);
  const slots = Object.fromEntries([...slotNames].map((s) => [s, "x"]));
  const flow = flowKey(f.intent, slots);
  if (f.intent === "book_meeting") throw new Error("synthetic flow must not be the booking flow");
  return { ...f, flow, pages };
});

function makeState(): { flow: string; page: PageState; action: Action; post: PageState } {
  const f = pick(flows);
  const pi = Math.floor(rnd() * f.pages.length);
  const p = f.pages[pi];
  const elements: PageElement[] = [];
  let firstEmpty: Field | undefined;
  for (const fl of p.fields) {
    const el: PageElement = { id: "", role: fl.role, label: fl.label };
    if (fl.role === "textbox" || fl.role === "textarea" || fl.role === "select") {
      const filled = rnd() < 0.5;
      el.value = filled ? (fl.slot ? `{${fl.slot}}` : "(filled)") : "";
      if (fl.role === "select") el.options = ["Option A", "Option B"];
      if (!filled && !firstEmpty) firstEmpty = fl;
    } else if (fl.role === "checkbox") {
      el.value = rnd() < 0.5 ? "checked" : "unchecked";
    }
    if (fl.role === "button" && rnd() < 0.1) el.disabled = true;
    elements.push(el);
  }
  // App chrome (nav links) and occasional layout jitter.
  const nav: PageElement[] = chromeFor(f.app).map((l) => ({ id: "", role: "link", label: l }));
  if (rnd() < 0.15) for (let i = elements.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [elements[i], elements[j]] = [elements[j], elements[i]]; }
  const all = [...nav, ...elements].map((e, i) => ({ ...e, id: `e${i}` }));
  const page: PageState = { route: p.route, heading: p.heading, elements: all };

  let action: Action;
  let post: PageState = page;
  if (firstEmpty) {
    action = firstEmpty.role === "select"
      ? { kind: "select", role: "select", label: firstEmpty.label, option: firstEmpty.slot ? `{${firstEmpty.slot}}` : "Option A" }
      : { kind: "type", role: firstEmpty.role as "textbox" | "textarea", label: firstEmpty.label, text: firstEmpty.slot ? `{${firstEmpty.slot}}` : "..." };
  } else {
    const btns = p.fields.filter((x) => x.role === "button");
    const last = btns[btns.length - 1] ?? p.fields[p.fields.length - 1];
    if (!btns.length && pi === f.pages.length - 1) action = { kind: "done", summary: "completed" };
    else action = { kind: "click", role: last.role, label: last.label };
    const next = f.pages[Math.min(pi + 1, f.pages.length - 1)];
    post = { route: next.route, heading: next.heading, elements: [] };
  }
  return { flow: f.flow, page, action, post };
}

async function main() {
  console.log(`[seed] ${flows.length} flows, generating ${N} synthetic reflexes`);
  const meta: Reflex[] = [];
  const texts: string[] = [];
  for (let i = 0; i < N; i++) {
    const s = makeState();
    const preKey = stateKey(s.flow, s.page, {});
    meta.push({
      id: `syn-${i}`,
      flow: s.flow,
      preKey,
      action: s.action,
      postSignature: signature(s.post, {}),
      hits: Math.floor(rnd() * 20),
      misses: 0,
      createdAt: Date.now() - Math.floor(rnd() * 30 * 864e5),
      source: "synthetic",
    });
    texts.push(preKey);
  }
  console.log(`[seed] unique stateKeys: ${new Set(texts).size}`);
  const out = new Float32Array(N * DIM);
  const B = 64;
  const t0 = performance.now();
  for (let i = 0; i < N; i += B) {
    const v = await embedBatch(texts.slice(i, i + B));
    out.set(v, i * DIM);
    if ((i / B) % 20 === 0) process.stdout.write(`\r[seed] embedded ${i + v.length / DIM}/${N}`);
  }
  console.log(`\n[seed] embedding took ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "synthetic.meta.json"), JSON.stringify(meta));
  fs.writeFileSync(path.join(OUT, "synthetic.f32"), Buffer.from(out.buffer));
  console.log(`[seed] wrote data/synthetic.meta.json + data/synthetic.f32`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
