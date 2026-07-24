"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { PinPad } from "@/components/house-mode/PinPad";
import { INFO_ICON_MAP } from "@/lib/info/icons";
import { parseInfoBody } from "@/lib/info/parse-body";
import {
  INFO_ICONS,
  type InfoIconName,
  type InfoSection,
} from "@/lib/info/types";
import {
  isHouseModeDevice,
  isHouseModeUnlocked,
  setHouseModeDevice,
  setHouseModeUnlocked,
} from "@/lib/house-mode/settings";
import {
  createInfoSection,
  deleteInfoSection,
  reorderInfoSections,
  updateInfoSection,
} from "./actions";

type Props = {
  propertyName: string | null;
  initialSections: InfoSection[];
};

const TEXT_DEBOUNCE_MS = 600;

function sectionAnchorId(id: string) {
  return `info-section-${id}`;
}

function InfoBody({ body }: { body: string }) {
  const blocks = parseInfoBody(body);
  if (blocks.length === 0) {
    return <p className="text-[16.5px] leading-[1.6] text-stone-400"> </p>;
  }

  return (
    <div className="space-y-3 font-[family-name:var(--font-bricolage)] text-[16.5px] leading-[1.6] text-stone-700">
      {blocks.map((block, i) => {
        if (block.type === "paragraph") {
          return (
            <p key={i}>
              {block.lines.map((line, j) => (
                <span key={j}>
                  {j > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </p>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <ol key={i} className="list-decimal space-y-1 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ol>
        );
      })}
    </div>
  );
}

function SectionIcon({ name }: { name: string | null }) {
  if (!name || !(name in INFO_ICON_MAP)) return null;
  const Icon = INFO_ICON_MAP[name as InfoIconName];
  return <Icon className="h-6 w-6 shrink-0 text-[#E0972B]" strokeWidth={1.75} />;
}

export function HomeInfoView({ propertyName, initialSections }: Props) {
  const [sections, setSections] = useState(initialSections);
  const [editing, setEditing] = useState(false);
  const [needsPin, setNeedsPin] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinReset, setPinReset] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(
    initialSections[0]?.id ?? null,
  );
  const [savedFlash, setSavedFlash] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const stickyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSections(initialSections);
  }, [initialSections]);

  const flashSaved = useCallback(() => {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }, []);

  const requestEdit = useCallback(() => {
    if (!isHouseModeDevice() || isHouseModeUnlocked()) {
      setEditing(true);
      return;
    }
    setNeedsPin(true);
  }, []);

  const onPinComplete = useCallback(async (pin: string) => {
    setPinBusy(true);
    setPinError(null);
    try {
      const response = await fetch("/api/settings/house-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", pin }),
      });
      const body = (await response.json()) as {
        error?: string;
        hasPin?: boolean;
      };
      if (!response.ok) {
        setPinError(body.error ?? "Incorrect PIN");
        setPinReset((t) => t + 1);
        return;
      }
      if (body.hasPin === false) {
        setHouseModeDevice(false);
      }
      setHouseModeUnlocked(true);
      setNeedsPin(false);
      setEditing(true);
    } catch {
      setPinError("Could not verify PIN");
      setPinReset((t) => t + 1);
    } finally {
      setPinBusy(false);
    }
  }, []);

  // Scroll-spy against the app shell <main> scroller
  useEffect(() => {
    if (sections.length === 0 || editing) return;

    const nodes = sections
      .map((s) => document.getElementById(sectionAnchorId(s.id)))
      .filter(Boolean) as HTMLElement[];

    if (nodes.length === 0) return;

    const root = nodes[0]?.closest("main") ?? null;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (top?.target.id) {
          setActiveId(top.target.id.replace("info-section-", ""));
        }
      },
      {
        root,
        rootMargin: "-25% 0px -55% 0px",
        threshold: [0.1, 0.35, 0.6],
      },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [sections, editing]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(sectionAnchorId(id));
    if (!el) return;
    const stickyH = stickyRef.current?.offsetHeight ?? 0;
    const top =
      el.getBoundingClientRect().top + window.scrollY - stickyH - 12;
    const main = el.closest("main");
    if (main) {
      const mainTop =
        el.getBoundingClientRect().top -
        main.getBoundingClientRect().top +
        main.scrollTop -
        stickyH -
        12;
      main.scrollTo({ top: mainTop, behavior: "smooth" });
    } else {
      window.scrollTo({ top, behavior: "smooth" });
    }
    setActiveId(id);
  };

  const persistPatch = useCallback(
    async (
      id: string,
      patch: { title?: string; body?: string; icon?: string | null },
    ) => {
      setBusyId(id);
      const result = await updateInfoSection({ id, ...patch });
      setBusyId(null);
      if (result.ok && "section" in result && result.section) {
        setSections((prev) =>
          prev.map((s) => (s.id === id ? result.section : s)),
        );
        flashSaved();
      }
    },
    [flashSaved],
  );

  const commitText = useCallback(
    (id: string, title: string, body: string) => {
      setSections((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title, body } : s)),
      );
      void persistPatch(id, { title, body });
    },
    [persistPatch],
  );

  const commitIcon = useCallback(
    (id: string, icon: string | null) => {
      setSections((prev) =>
        prev.map((s) => (s.id === id ? { ...s, icon } : s)),
      );
      void persistPatch(id, { icon });
    },
    [persistPatch],
  );

  const moveSection = useCallback(
    async (id: string, direction: -1 | 1) => {
      setSections((prev) => {
        const index = prev.findIndex((s) => s.id === id);
        const next = index + direction;
        if (index < 0 || next < 0 || next >= prev.length) return prev;

        const reordered = [...prev];
        const [item] = reordered.splice(index, 1);
        reordered.splice(next, 0, item!);

        void (async () => {
          const result = await reorderInfoSections(reordered.map((s) => s.id));
          if (result.ok && "sections" in result && result.sections) {
            setSections(result.sections);
            flashSaved();
          }
        })();

        return reordered;
      });
    },
    [flashSaved],
  );

  const addSection = async () => {
    const result = await createInfoSection({ title: "New section", body: "" });
    if (result.ok && "section" in result && result.section) {
      setSections((prev) => [...prev, result.section]);
      flashSaved();
      window.setTimeout(() => scrollToSection(result.section.id), 100);
    }
  };

  const removeSection = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this section?")) return;
      const result = await deleteInfoSection(id);
      if (result.ok) {
        setSections((prev) => prev.filter((s) => s.id !== id));
        flashSaved();
      }
    },
    [flashSaved],
  );

  if (needsPin) {
    return (
      <div className="px-2 py-10 sm:px-0">
        <p className="mb-2 text-center text-sm font-medium uppercase tracking-widest text-[#F4B400]">
          House Mode
        </p>
        <PinPad
          title="Enter PIN"
          subtitle="Enter the house PIN to edit Home Info."
          onComplete={onPinComplete}
          error={pinError}
          busy={pinBusy}
          resetToken={pinReset}
        />
        <button
          type="button"
          onClick={() => setNeedsPin(false)}
          className="mx-auto mt-6 block text-sm font-medium text-stone-500 hover:text-stone-800"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="px-2 pb-6 sm:px-0">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1
            className="font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-stone-900 sm:text-4xl"
            style={{ fontVariationSettings: '"opsz" 72' }}
          >
            Home Info
          </h1>
          <p className="mt-1 text-base text-stone-600">
            {propertyName ?? "Your hive"}
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          {savedFlash && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FBF0D0] px-3 py-1.5 text-xs font-medium text-stone-800">
              <Check className="h-3.5 w-3.5 text-[#E0972B]" strokeWidth={2.5} />
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={() => (editing ? setEditing(false) : requestEdit())}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-[14px] px-4 text-sm font-semibold transition ${
              editing
                ? "bg-stone-900 text-white hover:bg-stone-800"
                : "border border-stone-200 bg-white text-stone-800 hover:border-[#F4B400]/50"
            }`}
          >
            {editing ? (
              <>
                <X className="h-4 w-4" strokeWidth={2.25} />
                Done
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4 text-[#E0972B]" strokeWidth={2.25} />
                Edit
              </>
            )}
          </button>
        </div>
      </header>

      {sections.length > 0 && (
        <div
          ref={stickyRef}
          className="sticky top-0 z-20 -mx-2 mb-6 bg-[#FAF8F3]/95 px-2 py-3 backdrop-blur-md sm:mx-0 sm:px-0"
        >
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {sections.map((section) => {
              const active = !editing && activeId === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-[#F4B400] text-stone-900"
                      : "border border-stone-200 bg-white text-stone-600 hover:border-[#F4B400]/50"
                  }`}
                >
                  {section.title || "Untitled"}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {sections.length === 0 ? (
        <div className="flex flex-col items-center rounded-[20px] bg-white px-6 py-14 text-center shadow-sm">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] bg-[#F4B400]/15 text-[#F4B400]">
            <BookOpen className="h-8 w-8" strokeWidth={1.75} />
          </span>
          <p className="text-lg font-semibold text-stone-900">
            No house info yet.
          </p>
          <p className="mt-2 max-w-sm text-sm text-stone-500">
            Add wifi, house rules, shutoffs, and anything guests need to know.
          </p>
          <button
            type="button"
            onClick={() => {
              if (isHouseModeDevice() && !isHouseModeUnlocked()) {
                setNeedsPin(true);
                return;
              }
              setEditing(true);
              void addSection();
            }}
            className="mt-6 inline-flex min-h-[52px] items-center gap-2 rounded-[18px] bg-[#F4B400] px-5 text-base font-semibold text-stone-900 transition hover:bg-[#e0a800]"
          >
            <Plus className="h-5 w-5" strokeWidth={2.25} />
            Add section
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={sectionAnchorId(section.id)}
              className="scroll-mt-24 rounded-[20px] bg-white p-5 shadow-sm sm:p-6"
            >
              {editing ? (
                <EditCard
                  sectionId={section.id}
                  initialTitle={section.title}
                  initialBody={section.body}
                  icon={section.icon}
                  isFirst={index === 0}
                  isLast={index === sections.length - 1}
                  busy={busyId === section.id}
                  onCommitText={commitText}
                  onIconChange={commitIcon}
                  onMoveUp={moveSection}
                  onMoveDown={moveSection}
                  onDelete={removeSection}
                />
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-3">
                    <SectionIcon name={section.icon} />
                    <h2
                      className="font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-stone-900"
                      style={{ fontVariationSettings: '"opsz" 72' }}
                    >
                      {section.title}
                    </h2>
                  </div>
                  <InfoBody body={section.body} />
                </>
              )}
            </section>
          ))}
        </div>
      )}

      {editing && (
        <button
          type="button"
          onClick={() => void addSection()}
          className="mt-6 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-[#F4B400]/50 bg-[#F4B400]/10 text-base font-semibold text-stone-900 transition hover:border-[#F4B400] hover:bg-[#F4B400]/20"
        >
          <Plus className="h-5 w-5 text-[#E0972B]" strokeWidth={2.25} />
          Add section
        </button>
      )}
    </div>
  );
}

type EditCardProps = {
  sectionId: string;
  initialTitle: string;
  initialBody: string;
  icon: string | null;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onCommitText: (id: string, title: string, body: string) => void;
  onIconChange: (id: string, icon: string | null) => void;
  onMoveUp: (id: string, direction: -1 | 1) => void;
  onMoveDown: (id: string, direction: -1 | 1) => void;
  onDelete: (id: string) => void;
};

const EditCard = memo(function EditCard({
  sectionId,
  initialTitle,
  initialBody,
  icon,
  isFirst,
  isLast,
  busy,
  onCommitText,
  onIconChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: EditCardProps) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ title: initialTitle, body: initialBody });
  const committedRef = useRef({ title: initialTitle, body: initialBody });

  useEffect(() => {
    latestRef.current = { title, body };
  }, [title, body]);

  // Remount-safe: only reset local fields when switching to a different section id.
  useEffect(() => {
    setTitle(initialTitle);
    setBody(initialBody);
    latestRef.current = { title: initialTitle, body: initialBody };
    committedRef.current = { title: initialTitle, body: initialBody };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ignore prop churn while typing
  }, [sectionId]);

  const flushCommit = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const next = latestRef.current;
    if (
      next.title === committedRef.current.title &&
      next.body === committedRef.current.body
    ) {
      return;
    }
    committedRef.current = next;
    onCommitText(sectionId, next.title, next.body);
  }, [onCommitText, sectionId]);

  const scheduleCommit = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      flushCommit();
    }, TEXT_DEBOUNCE_MS);
  }, [flushCommit]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      const next = latestRef.current;
      if (
        next.title !== committedRef.current.title ||
        next.body !== committedRef.current.body
      ) {
        committedRef.current = next;
        onCommitText(sectionId, next.title, next.body);
      }
    };
  }, [onCommitText, sectionId]);

  const growTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const main = el.closest("main");
    const prevScroll = main?.scrollTop ?? window.scrollY;
    const next = Math.max(120, el.scrollHeight);
    if (next > el.clientHeight + 1) {
      el.style.height = `${next}px`;
      if (main) main.scrollTop = prevScroll;
      else window.scrollTo({ top: prevScroll });
    }
  }, []);

  useEffect(() => {
    growTextarea();
  }, [body, growTextarea]);

  const onTitleInput = (e: FormEvent<HTMLInputElement>) => {
    setTitle(e.currentTarget.value);
    scheduleCommit();
  };

  const onBodyInput = (e: FormEvent<HTMLTextAreaElement>) => {
    setBody(e.currentTarget.value);
    scheduleCommit();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isFirst || busy}
          onClick={() => {
            flushCommit();
            onMoveUp(sectionId, -1);
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200 disabled:opacity-40"
          aria-label="Move up"
        >
          <ArrowUp className="h-5 w-5" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          disabled={isLast || busy}
          onClick={() => {
            flushCommit();
            onMoveDown(sectionId, 1);
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200 disabled:opacity-40"
          aria-label="Move down"
        >
          <ArrowDown className="h-5 w-5" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            flushCommit();
            onDelete(sectionId);
          }}
          className="ml-auto flex h-11 min-w-[44px] items-center justify-center gap-1.5 rounded-full bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-40"
          aria-label="Delete section"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.25} />
          Delete
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
          Icon
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onIconChange(sectionId, null)}
            className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
              !icon
                ? "bg-[#F4B400] text-stone-900"
                : "border border-stone-200 bg-white text-stone-500"
            }`}
          >
            None
          </button>
          {INFO_ICONS.map((name) => {
            const Icon = INFO_ICON_MAP[name];
            const active = icon === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => onIconChange(sectionId, name)}
                aria-label={name}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
                  active
                    ? "bg-[#F4B400] text-stone-900"
                    : "border border-stone-200 bg-white text-stone-600 hover:border-[#F4B400]/50"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </button>
            );
          })}
        </div>
      </div>

      <input
        type="text"
        value={title}
        onChange={onTitleInput}
        onBlur={flushCommit}
        maxLength={120}
        placeholder="Section title"
        className="w-full rounded-[14px] border border-stone-200 bg-[#FAF8F3] px-4 py-3 font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-stone-900 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
      />

      <textarea
        ref={textareaRef}
        value={body}
        onChange={onBodyInput}
        onBlur={flushCommit}
        placeholder={
          'Write plain text. Use blank lines for paragraphs, "- " for bullets, "1. " for numbered lists.'
        }
        style={{ minHeight: 120 }}
        className="w-full resize-none overflow-hidden rounded-[14px] border border-stone-200 bg-[#FAF8F3] px-4 py-3 font-[family-name:var(--font-bricolage)] text-[16.5px] leading-[1.6] text-stone-800 focus:border-[#F4B400] focus:outline-none focus:ring-2 focus:ring-[#F4B400]/30"
      />
    </div>
  );
});
