"use client";

import { useEffect, useRef, useState, type JSX, type ReactNode } from "react";

export type SlotlyVariant = "normal" | "shuffled" | "renamed";

type Route = "/" | "/book/day" | "/book/time" | "/book/details" | "/book/review" | "/book/done";

const MEETING_TYPES = [
  { name: "Demo call", minutes: 30, desc: "A guided tour of the Nova platform tailored to your team.", color: "bg-neutral-900" },
  { name: "Onboarding session", minutes: 60, desc: "Hands-on setup with a solutions engineer.", color: "bg-neutral-500" },
  { name: "Support call", minutes: 15, desc: "Quick help with an issue or question.", color: "bg-neutral-300" },
] as const;

const DAYS = [
  { name: "Monday", date: "Sep 28" },
  { name: "Tuesday", date: "Sep 29" },
  { name: "Wednesday", date: "Sep 30" },
  { name: "Thursday", date: "Oct 1" },
  { name: "Friday", date: "Oct 2" },
] as const;

const TIMES = ["9:00 AM", "10:00 AM", "11:00 AM", "2:00 PM", "3:00 PM", "4:00 PM"] as const;
const TIMES_SHUFFLED = ["3:00 PM", "9:00 AM", "4:00 PM", "11:00 AM", "2:00 PM", "10:00 AM"] as const;

const TEAM_SIZES = ["1-10", "11-50", "51-200", "200+"] as const;

const STEPS: { route: Route; label: string }[] = [
  { route: "/", label: "Type" },
  { route: "/book/day", label: "Day" },
  { route: "/book/time", label: "Time" },
  { route: "/book/details", label: "Details" },
  { route: "/book/review", label: "Review" },
];

interface Labels {
  name: string;
  email: string;
  teamSize: string;
  cont: string;
  confirm: string;
}

const LABELS_NORMAL: Labels = {
  name: "Full name",
  email: "Email",
  teamSize: "Team size",
  cont: "Continue",
  confirm: "Confirm booking",
};

const LABELS_RENAMED: Labels = {
  name: "Your name",
  email: "Work email",
  teamSize: "Company size",
  cont: "Next step",
  confirm: "Book it",
};

/* ---------- small presentational pieces (all non-interactive) ---------- */

function Stepper({ route }: { route: Route }) {
  const idx = route === "/book/done" ? STEPS.length : STEPS.findIndex((s) => s.route === route);
  return (
    <ol aria-hidden="true" className="flex items-baseline gap-5 text-[12.5px]">
      {STEPS.map((s, i) => (
        <li key={s.route} className={i === idx ? "text-neutral-900" : i < idx ? "text-neutral-600" : "text-neutral-400"}>
          <span className="mr-1.5 tabular-nums text-neutral-400">{i + 1}</span>
          <span
            className={i === idx ? "font-medium underline decoration-neutral-900 decoration-[1.5px] underline-offset-[6px]" : ""}
          >
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function BackButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "text-sm text-neutral-500 underline decoration-neutral-300 underline-offset-4 transition hover:text-neutral-900 hover:decoration-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900 " +
        className
      }
    >
      Back
    </button>
  );
}

const inputCls =
  "w-full border-0 border-b border-neutral-300 bg-transparent px-0 py-1.5 text-[15px] text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900";

const labelCls = "block text-[12.5px] text-neutral-500";

const primaryBtn =
  "inline-flex h-10 items-center justify-center bg-neutral-900 px-5 text-sm font-medium text-white transition hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400";

const secondaryBtn =
  "inline-flex h-10 items-center text-sm text-neutral-600 underline decoration-neutral-300 underline-offset-4 transition hover:text-neutral-900 hover:decoration-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900";

/* A choice row: text over a hairline; the whole row is the button's hit area. */
const choiceRow = "relative border-b border-neutral-200 transition hover:border-neutral-900";
const choiceBtn =
  "text-left font-medium text-neutral-900 outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-neutral-900";

/* ---------- main component ---------- */

export function SlotlyApp(props: { variant: SlotlyVariant; onRouteChange?: (route: string) => void }): JSX.Element {
  const { variant, onRouteChange } = props;
  const shuffled = variant === "shuffled";
  const L = variant === "renamed" ? LABELS_RENAMED : LABELS_NORMAL;

  const [route, setRoute] = useState<Route>("/");
  const [type, setType] = useState("");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [notes, setNotes] = useState("");
  const [agree, setAgree] = useState(false);

  const cbRef = useRef(onRouteChange);
  useEffect(() => {
    cbRef.current = onRouteChange;
  }, [onRouteChange]);
  useEffect(() => {
    cbRef.current?.(route);
  }, [route]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const go = (r: Route) => {
    setRoute(r);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const reset = () => {
    setType("");
    setDay("");
    setTime("");
    setName("");
    setEmail("");
    setTeamSize("");
    setNotes("");
    setAgree(false);
    go("/");
  };

  const canContinue = name.trim() !== "" && email.includes("@") && teamSize !== "" && agree;
  const meeting = MEETING_TYPES.find((m) => m.name === type);
  const dayInfo = DAYS.find((d) => d.name === day);

  /* ----- pages ----- */

  let heading: string;
  let body: ReactNode;

  if (route === "/") {
    heading = "Pick a meeting type";
    const types = shuffled ? [...MEETING_TYPES].reverse() : MEETING_TYPES;
    body = (
      <div className={shuffled ? "grid grid-cols-3 gap-8" : "flex flex-col border-t border-neutral-200"}>
        {types.map((m) => (
          <div
            key={m.name}
            className={
              choiceRow + (shuffled ? " flex flex-col gap-1.5 pb-4" : " grid grid-cols-[1fr_64px] items-baseline gap-6 py-4")
            }
          >
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => {
                  setType(m.name);
                  go("/book/day");
                }}
                className={choiceBtn + " text-[16px]"}
              >
                {m.name}
              </button>
              <p aria-hidden="true" className="mt-1 text-[13.5px] leading-snug text-neutral-500">
                {m.desc}
              </p>
            </div>
            <span
              aria-hidden="true"
              className={"text-[13px] tabular-nums text-neutral-500 " + (shuffled ? "order-first" : "text-right")}
            >
              {m.minutes} min
            </span>
          </div>
        ))}
      </div>
    );
  } else if (route === "/book/day") {
    heading = `${type} — choose a day`;
    const days = shuffled ? [...DAYS].reverse() : DAYS;
    body = (
      <div className="flex flex-col gap-6">
        {shuffled && (
          <div>
            <BackButton onClick={() => go("/")} />
          </div>
        )}
        <p aria-hidden="true" className="text-[13.5px] text-neutral-500">
          Week of September 28, all times in your local time zone
        </p>
        <div className={shuffled ? "flex flex-col border-t border-neutral-200" : "grid grid-cols-5 gap-5"}>
          {days.map((d) => (
            <div
              key={d.name}
              className={
                choiceRow +
                (shuffled
                  ? " grid grid-cols-[1fr_80px_64px] items-baseline gap-4 py-3.5"
                  : " flex flex-col gap-1 pb-3")
              }
            >
              <button
                type="button"
                onClick={() => {
                  setDay(d.name);
                  go("/book/time");
                }}
                className={choiceBtn + " text-[15px]"}
              >
                {d.name}
              </button>
              <span aria-hidden="true" className="text-[13px] tabular-nums text-neutral-500">
                {d.date}
              </span>
              <span aria-hidden="true" className={"text-[12.5px] text-neutral-400 " + (shuffled ? "text-right" : "")}>
                6 slots
              </span>
            </div>
          ))}
        </div>
        {!shuffled && (
          <div>
            <BackButton onClick={() => go("/")} />
          </div>
        )}
      </div>
    );
  } else if (route === "/book/time") {
    heading = `${day} — choose a time`;
    const times = shuffled ? TIMES_SHUFFLED : TIMES;
    body = (
      <div className="flex flex-col gap-6">
        <p aria-hidden="true" className="text-[13.5px] text-neutral-500">
          {dayInfo?.date ?? ""}, Eastern Time (US &amp; Canada)
        </p>
        <div className={shuffled ? "grid grid-cols-2 gap-x-8" : "grid grid-cols-3 gap-x-8"}>
          {times.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTime(t);
                go("/book/details");
              }}
              className={
                "border-b border-neutral-200 py-3 text-[15px] font-medium tabular-nums text-neutral-900 transition hover:border-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 " +
                (shuffled ? "text-right" : "text-left")
              }
            >
              {t}
            </button>
          ))}
        </div>
        <div className={shuffled ? "flex justify-end" : ""}>
          <BackButton onClick={() => go("/book/day")} />
        </div>
      </div>
    );
  } else if (route === "/book/details") {
    heading = "Your details";
    const fName = (
      <div key="name">
        <label htmlFor="slotly-name" className={labelCls}>
          {L.name}
        </label>
        <input id="slotly-name" type="text" autoComplete="off" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
    );
    const fEmail = (
      <div key="email">
        <label htmlFor="slotly-email" className={labelCls}>
          {L.email}
        </label>
        <input id="slotly-email" type="email" autoComplete="off" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
    );
    const fTeam = (
      <div key="team">
        <label htmlFor="slotly-team" className={labelCls}>
          {L.teamSize}
        </label>
        <select id="slotly-team" className={inputCls + " cursor-pointer"} value={teamSize} onChange={(e) => setTeamSize(e.target.value)}>
          <option value="">Select…</option>
          {TEAM_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    );
    const fNotes = (
      <div key="notes" className={shuffled ? "" : "col-span-2"}>
        <label htmlFor="slotly-notes" className={labelCls}>
          Notes
        </label>
        <textarea id="slotly-notes" rows={2} className={inputCls + " resize-none"} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    );
    const fAgree = (
      <div key="agree" className={"flex items-center gap-2.5 " + (shuffled ? "" : "col-span-2")}>
        <input
          id="slotly-agree"
          type="checkbox"
          className="h-4 w-4 accent-neutral-900"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
        />
        <label htmlFor="slotly-agree" className="text-[13.5px] text-neutral-700">
          I agree to the terms
        </label>
      </div>
    );
    const fields = shuffled ? [fEmail, fTeam, fName, fAgree, fNotes] : [fName, fEmail, fTeam, fNotes, fAgree];
    const cont = (
      <button type="button" disabled={!canContinue} onClick={() => go("/book/review")} className={primaryBtn}>
        {L.cont}
      </button>
    );
    const back = <BackButton onClick={() => go("/book/time")} />;
    body = (
      <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-8">
        <div className={shuffled ? "flex max-w-[360px] flex-col gap-5" : "grid grid-cols-2 gap-x-8 gap-y-5"}>{fields}</div>
        <div className={"flex items-center gap-6 " + (shuffled ? "flex-row-reverse justify-end" : "justify-between")}>
          {back}
          {cont}
        </div>
      </form>
    );
  } else if (route === "/book/review") {
    heading = "Review your booking";
    const rows: [string, string][] = [
      ["Meeting", type],
      ["Day", `${day}${dayInfo ? `, ${dayInfo.date}` : ""}`],
      ["Time", time],
      [L.name, name],
      [L.email, email],
      [L.teamSize, teamSize],
    ];
    const ordered = shuffled ? [rows[3], rows[4], rows[5], rows[0], rows[1], rows[2]] : rows;
    const edit = (
      <button key="edit" type="button" onClick={() => go("/book/details")} className={secondaryBtn}>
        Edit details
      </button>
    );
    const confirm = (
      <button key="confirm" type="button" onClick={() => go("/book/done")} className={primaryBtn}>
        {L.confirm}
      </button>
    );
    body = (
      <div className="flex flex-col gap-8">
        <dl className={shuffled ? "grid grid-cols-2 gap-x-8 gap-y-5" : "flex flex-col"}>
          {ordered.map(([k, v]) => (
            <div
              key={k}
              className={
                shuffled
                  ? "flex flex-col gap-1"
                  : "grid grid-cols-[140px_1fr] items-baseline border-b border-neutral-200 py-2.5 first:border-t"
              }
            >
              <dt className="text-[13px] text-neutral-500">{k}</dt>
              <dd className="text-[15px] font-medium text-neutral-900">{v}</dd>
            </div>
          ))}
        </dl>
        {notes.trim() && (
          <p className="text-[13.5px] text-neutral-600">
            <span className="text-neutral-500">Notes: </span>
            {notes}
          </p>
        )}
        <div className={"flex items-center gap-6 " + (shuffled ? "justify-start" : "justify-end")}>{shuffled ? [confirm, edit] : [edit, confirm]}</div>
      </div>
    );
  } else {
    heading = `You're booked, ${name}!`;
    body = (
      <div className="flex max-w-[440px] flex-col items-start gap-6">
        <p className="text-[15px] leading-relaxed text-neutral-600">
          A calendar invitation for your <span className="font-medium text-neutral-900">{type}</span> with Nova Labs on{" "}
          <span className="font-medium text-neutral-900">
            {day} at {time}
          </span>{" "}
          has been sent to <span className="font-medium text-neutral-900">{email}</span>.
        </p>
        <button type="button" onClick={reset} className={primaryBtn}>
          Book another
        </button>
      </div>
    );
  }

  /* ----- shell ----- */

  const facts = [meeting ? `${meeting.minutes} minutes` : "15 to 60 minutes", "Video call", day ? `${day}${time ? `, ${time}` : ""}` : "", "Eastern Time"].filter(Boolean);

  const sidebar = (
    <aside
      aria-hidden="true"
      className={
        "flex w-[196px] shrink-0 flex-col gap-6 py-1 " +
        (shuffled ? "border-l border-neutral-200 pl-8" : "border-r border-neutral-200 pr-8")
      }
    >
      <div>
        <div className="text-[13px] text-neutral-500">Nova Labs</div>
        <div className="mt-1 text-[19px] font-medium leading-tight tracking-[-0.01em] text-neutral-900">{type || "Book a meeting"}</div>
      </div>
      <ul className="flex flex-col gap-1.5 text-[13.5px] text-neutral-600">
        {facts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <div className="mt-auto text-[11.5px] leading-snug text-neutral-400">Powered by Slotly. Privacy, Terms.</div>
    </aside>
  );

  const main = (
    <section className={"flex min-w-0 flex-1 flex-col gap-5 " + (shuffled ? "pr-10" : "pl-10")}>
      <Stepper route={route} />
      <h1 className="mt-3 text-[26px] font-medium leading-tight tracking-[-0.015em] text-neutral-900">{heading}</h1>
      <div key={route} className="slotly-fade mt-2">
        {body}
      </div>
    </section>
  );

  return (
    <div data-rx-root data-route={route} className="h-full w-full bg-white font-sans text-neutral-900 antialiased">
      <style>{`@keyframes slotly-fade{from{opacity:0}to{opacity:1}}.slotly-fade{animation:slotly-fade .2s ease-out}@media (prefers-reduced-motion:reduce){.slotly-fade{animation:none}}`}</style>
      <div ref={scrollRef} className="h-full w-full overflow-y-auto">
        <div className="flex min-h-full flex-col px-10 pt-8 pb-10">
          <header aria-hidden="true" className="mb-10 flex items-baseline justify-between">
            <span className="text-[17px] font-semibold tracking-[-0.02em] text-neutral-900">Slotly</span>
            <span className="text-[13px] text-neutral-500">Booking with Nova Labs</span>
          </header>
          <div className="flex min-h-[420px] flex-1">
            {shuffled ? (
              <>
                {main}
                {sidebar}
              </>
            ) : (
              <>
                {sidebar}
                {main}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SlotlyApp;
