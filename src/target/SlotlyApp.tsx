"use client";

import { useEffect, useRef, useState, type JSX, type ReactNode } from "react";

export type SlotlyVariant = "normal" | "shuffled" | "renamed";

type Route = "/" | "/book/day" | "/book/time" | "/book/details" | "/book/review" | "/book/done";

const MEETING_TYPES = [
  { name: "Demo call", minutes: 30, desc: "A guided tour of the Nova platform tailored to your team.", color: "bg-indigo-500" },
  { name: "Onboarding session", minutes: 60, desc: "Hands-on setup with a solutions engineer.", color: "bg-emerald-500" },
  { name: "Support call", minutes: 15, desc: "Quick help with an issue or question.", color: "bg-amber-500" },
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

function BrandMark() {
  return (
    <div className="flex items-center gap-2 select-none" aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="9" fill="url(#slotly-g)" />
        <rect x="8" y="9" width="16" height="15" rx="3" stroke="white" strokeWidth="2" />
        <path d="M8 14h16" stroke="white" strokeWidth="2" />
        <path d="M12.5 19l2.2 2.2 4.8-4.8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="slotly-g" x1="0" y1="0" x2="32" y2="32">
            <stop stopColor="#6366F1" />
            <stop offset="1" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
      </svg>
      <span className="text-[15px] font-semibold tracking-tight text-slate-900">Slotly</span>
    </div>
  );
}

function HostAvatar({ size = 40 }: { size?: number }) {
  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 font-semibold text-white shadow-sm ring-2 ring-white"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      NL
    </div>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400">
      <path d={d} />
    </svg>
  );
}

const ICON_CLOCK = "M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z";
const ICON_VIDEO = "M15 10l5-3v10l-5-3M3 7h12v10H3z";
const ICON_CAL = "M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z";
const ICON_GLOBE = "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20";

function Stepper({ route }: { route: Route }) {
  const idx = route === "/book/done" ? STEPS.length : STEPS.findIndex((s) => s.route === route);
  return (
    <ol aria-hidden="true" className="flex items-center gap-1.5">
      {STEPS.map((s, i) => (
        <li key={s.route} className="flex items-center gap-1.5">
          <span
            className={
              "flex h-5 items-center rounded-full px-2 text-[11px] font-medium transition-colors " +
              (i < idx ? "bg-indigo-100 text-indigo-700" : i === idx ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400")
            }
          >
            {s.label}
          </span>
          {i < STEPS.length - 1 && <span className="h-px w-2 bg-slate-200" />}
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
        "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-500 " +
        className
      }
    >
      Back
    </button>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

const labelCls = "mb-1 block text-[13px] font-medium text-slate-700";

const primaryBtn =
  "inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none";

const secondaryBtn =
  "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500";

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
      <div className={shuffled ? "grid grid-cols-3 gap-3" : "flex flex-col gap-2.5"}>
        {types.map((m) => (
          <div
            key={m.name}
            className={
              "group relative rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-px hover:border-indigo-300 hover:shadow-md " +
              (shuffled ? "flex flex-col gap-2 p-3" : "flex items-start gap-3 p-4")
            }
          >
            <span aria-hidden="true" className={"mt-1 h-2.5 w-2.5 shrink-0 rounded-full " + m.color} />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => {
                  setType(m.name);
                  go("/book/day");
                }}
                className="text-left text-[15px] font-semibold text-slate-900 outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-indigo-500"
              >
                {m.name}
              </button>
              <p aria-hidden="true" className="mt-0.5 text-[13px] leading-snug text-slate-500">
                {m.desc}
              </p>
            </div>
            <span
              aria-hidden="true"
              className={
                "flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 " +
                (shuffled ? "self-start" : "shrink-0")
              }
            >
              <Icon d={ICON_CLOCK} />
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
      <div className="flex flex-col gap-4">
        {shuffled && (
          <div>
            <BackButton onClick={() => go("/")} />
          </div>
        )}
        <p aria-hidden="true" className="text-[13px] text-slate-500">
          Week of September 28 · all times shown in your local time zone
        </p>
        <div className={shuffled ? "flex flex-col gap-2" : "grid grid-cols-5 gap-2"}>
          {days.map((d) => (
            <div
              key={d.name}
              className={
                "relative rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-indigo-400 hover:bg-indigo-50/60 " +
                (shuffled ? "flex items-center justify-between px-4 py-3" : "flex flex-col items-center gap-1 px-1 py-4")
              }
            >
              <button
                type="button"
                onClick={() => {
                  setDay(d.name);
                  go("/book/time");
                }}
                className="text-[13px] font-semibold text-slate-900 outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-indigo-500"
              >
                {d.name}
              </button>
              <span aria-hidden="true" className="text-xs text-slate-500">
                {d.date}
              </span>
              <span aria-hidden="true" className="text-[11px] font-medium text-emerald-600">
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
      <div className="flex flex-col gap-4">
        <p aria-hidden="true" className="flex items-center gap-1.5 text-[13px] text-slate-500">
          <Icon d={ICON_GLOBE} />
          {dayInfo?.date ?? ""} · Eastern Time (US &amp; Canada)
        </p>
        <div className={shuffled ? "grid grid-cols-2 gap-2.5" : "grid grid-cols-3 gap-2.5"}>
          {times.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTime(t);
                go("/book/details");
              }}
              className={
                "rounded-lg border border-indigo-200 bg-white py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-500 hover:bg-indigo-600 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-500 " +
                (shuffled ? "text-left px-4" : "text-center")
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
        <select id="slotly-team" className={inputCls} value={teamSize} onChange={(e) => setTeamSize(e.target.value)}>
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
        <textarea id="slotly-notes" rows={3} className={inputCls + " resize-none"} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    );
    const fAgree = (
      <div key="agree" className={"flex items-center gap-2 " + (shuffled ? "" : "col-span-2")}>
        <input
          id="slotly-agree"
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
        />
        <label htmlFor="slotly-agree" className="text-[13px] text-slate-700">
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
      <form
        onSubmit={(e) => e.preventDefault()}
        noValidate
        className="flex flex-col gap-5"
      >
        <div className={shuffled ? "flex flex-col gap-3.5" : "grid grid-cols-2 gap-x-3 gap-y-3.5"}>{fields}</div>
        <div className={"flex items-center gap-2 " + (shuffled ? "flex-row-reverse justify-start" : "justify-between")}>
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
      <div className="flex flex-col gap-5">
        <dl className={shuffled ? "grid grid-cols-2 gap-3" : "divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white"}>
          {ordered.map(([k, v]) => (
            <div
              key={k}
              className={shuffled ? "rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm" : "flex items-center justify-between px-4 py-2.5"}
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{k}</dt>
              <dd className="text-sm font-medium text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
        {notes.trim() && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-600">
            <span className="font-medium text-slate-700">Notes: </span>
            {notes}
          </p>
        )}
        <div className={"flex gap-2 " + (shuffled ? "justify-start" : "justify-end")}>{shuffled ? [confirm, edit] : [edit, confirm]}</div>
      </div>
    );
  } else {
    heading = `You're booked, ${name}!`;
    body = (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        <p className="max-w-sm text-sm text-slate-600">
          A calendar invitation for your <span className="font-medium text-slate-900">{type}</span> with Nova Labs on{" "}
          <span className="font-medium text-slate-900">
            {day} at {time}
          </span>{" "}
          has been sent to <span className="font-medium text-slate-900">{email}</span>.
        </p>
        <button type="button" onClick={reset} className={primaryBtn}>
          Book another
        </button>
      </div>
    );
  }

  /* ----- shell ----- */

  const sidebar = (
    <aside
      aria-hidden="true"
      className={
        "flex shrink-0 flex-col gap-4 bg-slate-50/80 p-5 " +
        (shuffled ? "w-[200px] border-l border-slate-200" : "w-[210px] border-r border-slate-200")
      }
    >
      <HostAvatar size={shuffled ? 36 : 44} />
      <div>
        <div className="text-[13px] font-medium text-slate-500">Nova Labs</div>
        <div className="mt-0.5 text-base font-semibold leading-tight text-slate-900">{type || "Book a meeting"}</div>
      </div>
      <div className="flex flex-col gap-2 text-[13px] text-slate-600">
        <div className="flex items-center gap-2">
          <Icon d={ICON_CLOCK} />
          {meeting ? `${meeting.minutes} min` : "15–60 min"}
        </div>
        <div className="flex items-center gap-2">
          <Icon d={ICON_VIDEO} />
          Video call
        </div>
        {day && (
          <div className="flex items-center gap-2">
            <Icon d={ICON_CAL} />
            {day}
            {time ? `, ${time}` : ""}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Icon d={ICON_GLOBE} />
          Eastern Time
        </div>
      </div>
      <div className="mt-auto text-[11px] leading-snug text-slate-400">Powered by Slotly · Privacy · Terms</div>
    </aside>
  );

  const main = (
    <section className="flex min-w-0 flex-1 flex-col gap-4 p-6">
      <Stepper route={route} />
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">{heading}</h1>
      <div key={route} className="slotly-fade">
        {body}
      </div>
    </section>
  );

  return (
    <div data-rx-root data-route={route} className="h-full w-full bg-gradient-to-b from-slate-100 to-slate-200/70 font-sans text-slate-900 antialiased">
      <style>{`@keyframes slotly-fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}.slotly-fade{animation:slotly-fade .22s ease-out}`}</style>
      <div ref={scrollRef} className="h-full w-full overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-[760px] flex-col gap-3 p-4">
          <header aria-hidden="true" className="flex items-center justify-between px-1">
            <BrandMark />
            <div className="flex items-center gap-2 text-[13px] text-slate-500">
              <span>Nova Labs</span>
              <HostAvatar size={24} />
            </div>
          </header>
          <div
            className={
              "flex overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-8px_rgba(15,23,42,0.12)]"
            }
          >
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
