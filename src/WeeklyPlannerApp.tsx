"use client";

import React, { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Settings2, Trash2, Upload, X, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsRangeField } from "@/components/planner/SettingsRangeField";
import { removePlannerBackground, uploadPlannerBackground } from "@/lib/cloudMedia";
import { fetchRemotePlannerState, saveRemotePlannerState } from "@/lib/cloudPlanner";
import { DEFAULT_DECOR_MEDIA, DEFAULT_DECOR_THEME, type DecorMediaState, type DecorState, type DecorThemeState, type MediaFitMode, splitDecorState } from "@/lib/decorConfig";
import { DAILY_MESSAGES } from "@/lib/dailyMessages";
import { buildPanelTheme } from "@/lib/plannerTheme";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

const weekDays = ["일", "월", "화", "수", "목", "금", "토"];
const SLEEP_COLOR = "#94a3b8";
const SCHOOL_COLOR = "#60a5fa";
const PLAN_SWATCHES = ["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];
const STORAGE_KEY = "weekly_planner_fixed_v6";
const FALLBACK_KR_HOLIDAYS: Record<string, string> = {
  "01-01": "신정",
  "03-01": "삼일절",
  "05-05": "어린이날",
  "06-06": "현충일",
  "08-15": "광복절",
  "10-03": "개천절",
  "10-09": "한글날",
  "12-25": "성탄절",
};

const SCHOOL_PERIOD_TEMPLATES: Record<number, Array<{ start: string; end: string }>> = {
  4: [
    { start: "08:30", end: "09:20" },
    { start: "09:30", end: "10:20" },
    { start: "10:30", end: "11:20" },
    { start: "11:30", end: "12:20" },
  ],
  5: [
    { start: "08:30", end: "09:20" },
    { start: "09:30", end: "10:20" },
    { start: "10:30", end: "11:20" },
    { start: "11:30", end: "12:20" },
    { start: "13:00", end: "13:50" },
  ],
  6: [
    { start: "08:30", end: "09:20" },
    { start: "09:30", end: "10:20" },
    { start: "10:30", end: "11:20" },
    { start: "11:30", end: "12:20" },
    { start: "13:00", end: "13:50" },
    { start: "14:00", end: "14:50" },
  ],
  7: [
    { start: "08:30", end: "09:20" },
    { start: "09:30", end: "10:20" },
    { start: "10:30", end: "11:20" },
    { start: "11:30", end: "12:20" },
    { start: "13:00", end: "13:50" },
    { start: "14:00", end: "14:50" },
    { start: "15:00", end: "15:50" },
  ],
};

type Block = { start: string; end: string };
type SleepState = { enabled: boolean; start: string; end: string };
type SchoolState = {
  enabled: boolean;
  schedule: Record<number, Block[]>;
};
type TodoItem = { id: string; text: string; important: boolean; done: boolean };
type TodosState = Record<string, TodoItem[]>;
type PlansState = Record<string, Record<string, string>>;
type PlanSyncState = { byWeekday: boolean };
type ProfileType = "student" | "worker" | "none";
type HolidayItem = { date: string; localName?: string; name?: string };
type InteractionState = {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  feedbackStrength: number;
};
type PlannerMeta = {
  updatedAt: number;
};
type SavedState = {
  plans?: PlansState;
  sleep?: SleepState;
  school?: SchoolState;
  interval?: number;
  decor?: DecorState;
  decorTheme?: DecorThemeState;
  decorMedia?: DecorMediaState;
  todos?: TodosState;
  planSync?: PlanSyncState;
  profile?: ProfileType;
  interaction?: InteractionState;
  meta?: PlannerMeta;
};
type Segment = { start: number; end: number; color: string; label: string };

const DEFAULT_SLEEP: SleepState = { enabled: true, start: "00:00", end: "07:00" };
const DEFAULT_SCHOOL: SchoolState = {
  enabled: true,
  schedule: {
    0: [],
    1: [{ start: "08:30", end: "16:30" }],
    2: [{ start: "08:30", end: "16:30" }],
    3: [{ start: "08:30", end: "16:30" }],
    4: [{ start: "08:30", end: "16:30" }],
    5: [{ start: "08:30", end: "16:30" }],
    6: [],
  },
};
const DEFAULT_PLAN_SYNC: PlanSyncState = { byWeekday: false };
const DEFAULT_PROFILE: ProfileType = "student";
const DEFAULT_INTERACTION: InteractionState = {
  soundEnabled: true,
  vibrationEnabled: true,
  feedbackStrength: 0.62,
};
const WEEKDAY_EDIT_OPTIONS = [1, 2, 3, 4, 5];
const PLANNER_DB_NAME = "weekly-planner-db";
const PLANNER_DB_VERSION = 1;
const PLANNER_MEDIA_STORE = "media";
const PLANNER_MEDIA_KEY = "uploaded-background";
const monthSlideVariants = {
  enter: (direction: number) => ({
    x: direction >= 0 ? 140 : -140,
    opacity: 0,
    scale: 0.985,
    filter: "blur(10px)",
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
  },
  exit: (direction: number) => ({
    x: direction >= 0 ? -140 : 140,
    opacity: 0,
    scale: 0.985,
    filter: "blur(10px)",
  }),
};

function getMonthData(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstWeekday = firstDay.getDay();
  const cells: Array<number | null> = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= lastDay.getDate(); day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return { cells };
}

function buildYearOptions(centerYear: number) {
  return Array.from({ length: 21 }, (_, index) => centerYear - 10 + index);
}

function getDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getFallbackKrHolidayName(date: Date) {
  const monthDay = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return FALLBACK_KR_HOLIDAYS[monthDay] || "";
}

function getWeekdayPlanKey(date: Date) {
  return `weekday-${date.getDay()}`;
}

function getPlanKey(date: Date, syncByWeekday: boolean) {
  return syncByWeekday ? getWeekdayPlanKey(date) : getDateKey(date);
}

function getTodoPanelLabels(date: Date) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dateKey = getDateKey(date);

  if (dateKey === getDateKey(today)) {
    return { title: "오늘 할 일", empty: "오늘 할 일이 없어" };
  }

  if (dateKey === getDateKey(tomorrow)) {
    return { title: "내일 할 일", empty: "내일 할 일이 없어" };
  }

  return {
    title: `${date.getMonth() + 1}월 ${date.getDate()}일 할 일`,
    empty: `${date.getMonth() + 1}월 ${date.getDate()}일 할 일이 없어`,
  };
}

function getHolidayEmoji(holidayName: string) {
  const normalized = holidayName.toLowerCase();
  if (normalized.includes("christmas") || holidayName.includes("성탄")) return "🎄";
  if (holidayName.includes("설")) return "🧧";
  if (holidayName.includes("추석")) return "🌕";
  if (holidayName.includes("어린이")) return "🧸";
  if (holidayName.includes("현충")) return "🕊️";
  if (holidayName.includes("광복")) return "🇰🇷";
  if (holidayName.includes("개천")) return "🌤️";
  if (holidayName.includes("한글")) return "🔤";
  if (holidayName.includes("신정") || normalized.includes("new year")) return "🎆";
  return "🎉";
}

function PlannerZoomIcon({ zoomed }: { zoomed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 text-white">
      {zoomed ? (
        <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 4H4v4" />
          <path d="M16 4h4v4" />
          <path d="M4 16v4h4" />
          <path d="M20 16v4h-4" />
          <path d="M9 9l-5-5" />
          <path d="M15 9l5-5" />
          <path d="M9 15l-5 5" />
          <path d="M15 15l5 5" />
        </g>
      ) : (
        <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 4H4v5" />
          <path d="M15 4h5v5" />
          <path d="M4 15v5h5" />
          <path d="M20 15v5h-5" />
          <path d="M9 9L4 4" />
          <path d="M15 9l5-5" />
          <path d="M9 15l-5 5" />
          <path d="M15 15l5 5" />
        </g>
      )}
    </svg>
  );
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getColoredPlanEntries(plansForDay: Record<string, string> | undefined) {
  return Object.entries(plansForDay || {})
    .filter(([, value]) => value.trim())
    .sort((a, b) => timeToMinutes(a[0]) - timeToMinutes(b[0]))
    .map(([time, value]) => ({
      time,
      value,
      color: PLAN_SWATCHES[hashString(`${time}|${value}`) % PLAN_SWATCHES.length],
    }));
}

function mixColors(colors: string[]) {
  const rgbValues = colors.map((color) => hexToRgb(color)).filter(Boolean) as Array<{ r: number; g: number; b: number }>;
  if (rgbValues.length === 0) return "#64748b";
  const total = rgbValues.reduce((acc, color) => ({
    r: acc.r + color.r,
    g: acc.g + color.g,
    b: acc.b + color.b,
  }), { r: 0, g: 0, b: 0 });
  const count = rgbValues.length;
  const toHex = (value: number) => Math.round(value).toString(16).padStart(2, "0");
  return `#${toHex(total.r / count)}${toHex(total.g / count)}${toHex(total.b / count)}`;
}

function buildMixedDotBackground(colors: string[]) {
  const uniqueColors = Array.from(new Set(colors));
  if (uniqueColors.length === 0) return "#64748b";
  if (uniqueColors.length === 1) return uniqueColors[0];
  const step = 100 / uniqueColors.length;
  const stops = uniqueColors.map((color, index) => {
    const start = (index * step).toFixed(2);
    const end = ((index + 1) * step).toFixed(2);
    return `${color} ${start}% ${end}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function pickRandomIndex(length: number, previous = -1) {
  if (length <= 1) return 0;
  let next = Math.floor(Math.random() * length);
  if (next === previous) next = (next + 1 + Math.floor(Math.random() * (length - 1))) % length;
  return next;
}

function openPlannerDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(PLANNER_DB_NAME, PLANNER_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PLANNER_MEDIA_STORE)) {
        db.createObjectStore(PLANNER_MEDIA_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("indexeddb open failed"));
  });
}

function saveUploadedMediaToDb(blob: Blob, uploadedMediaType: "image" | "video") {
  return openPlannerDb().then((db) => new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PLANNER_MEDIA_STORE, "readwrite");
    const store = transaction.objectStore(PLANNER_MEDIA_STORE);
    store.put({ key: PLANNER_MEDIA_KEY, blob, uploadedMediaType });
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("indexeddb save failed"));
    };
  }));
}

function loadUploadedMediaFromDb() {
  return openPlannerDb().then((db) => new Promise<{ blob: Blob; uploadedMediaType: "image" | "video" } | null>((resolve, reject) => {
    const transaction = db.transaction(PLANNER_MEDIA_STORE, "readonly");
    const store = transaction.objectStore(PLANNER_MEDIA_STORE);
    const request = store.get(PLANNER_MEDIA_KEY);
    request.onsuccess = () => {
      db.close();
      if (!request.result) {
        resolve(null);
        return;
      }
      resolve({ blob: request.result.blob as Blob, uploadedMediaType: request.result.uploadedMediaType as "image" | "video" });
    };
    request.onerror = () => {
      db.close();
      reject(request.error || new Error("indexeddb load failed"));
    };
  }));
}

function clearUploadedMediaFromDb() {
  return openPlannerDb().then((db) => new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PLANNER_MEDIA_STORE, "readwrite");
    const store = transaction.objectStore(PLANNER_MEDIA_STORE);
    store.delete(PLANNER_MEDIA_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("indexeddb clear failed"));
    };
  }));
}

function timeToMinutes(value: string) {
  const [h, m] = String(value).split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(total: number) {
  const normalized = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getBlockRanges(start: string, end: string): Array<[number, number]> {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === e) return [];
  if (s < e) return [[s, e]];
  return [[s, 1440], [0, e]];
}

function isMinuteInsideRanges(minute: number, ranges: Array<[number, number]>) {
  return ranges.some(([start, end]) => minute >= start && minute < end);
}

function generateTimeSlots(interval: number, sleep: SleepState, schoolBlocks: Block[], schoolEnabled: boolean) {
  const slots: string[] = [];
  const sleepRanges = sleep.enabled ? getBlockRanges(sleep.start, sleep.end) : [];
  const schoolRanges = schoolEnabled ? schoolBlocks.flatMap((b) => getBlockRanges(b.start, b.end)) : [];
  const lunchRanges = schoolEnabled && schoolBlocks.length >= 5 ? getBlockRanges("12:20", "13:00") : [];

  for (let h = 0; h < 24; h += 1) {
    for (let m = 0; m < 60; m += interval) {
      const minute = h * 60 + m;
      if (isMinuteInsideRanges(minute, sleepRanges)) continue;
      if (isMinuteInsideRanges(minute, schoolRanges)) continue;
      if (isMinuteInsideRanges(minute, lunchRanges)) continue;
      slots.push(minutesToTime(minute));
    }
  }
  return slots;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(angleInRadians), y: cy + radius * Math.sin(angleInRadians) };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const safeEndAngle = endAngle <= startAngle ? startAngle + 0.5 : endAngle;
  const start = polarToCartesian(cx, cy, radius, safeEndAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = safeEndAngle - startAngle <= 180 ? "0" : "1";
  return ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(" ");
}

function buildCircleSegments(
  plansForDay: Record<string, string> | undefined,
  interval: number,
  sleep: SleepState,
  schoolBlocks: Block[],
  schoolEnabled: boolean,
  scheduleLabel: string,
) {
  const segments: Segment[] = [];

  if (sleep.enabled) {
    getBlockRanges(sleep.start, sleep.end).forEach(([start, end]) => segments.push({ start, end, color: SLEEP_COLOR, label: "?섎㈃" }));
  }

  if (schoolEnabled) {
    const schoolStart = schoolBlocks.length ? timeToMinutes(schoolBlocks[0].start) : null;
    const schoolEnd = schoolBlocks.length ? timeToMinutes(schoolBlocks[schoolBlocks.length - 1].end) : null;
    if (schoolStart !== null && schoolEnd !== null) {
      getBlockRanges(minutesToTime(schoolStart), minutesToTime(schoolEnd)).forEach(([start, end]) => {
        segments.push({ start, end, color: SCHOOL_COLOR, label: scheduleLabel });
      });
    }
  }

  getColoredPlanEntries(plansForDay).forEach(({ time, value, color }) => {
    const start = timeToMinutes(time);
    const end = Math.min(start + interval, 1440);
    segments.push({ start, end, color, label: value });
  });

  return segments.sort((a, b) => a.start - b.start);
}

function loadSavedPlanner(): SavedState | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedState;
  } catch {
    return null;
  }
}

function getSavedStateUpdatedAt(saved?: SavedState | null) {
  return saved?.meta?.updatedAt || 0;
}

function runPlannerSanityChecks() {
  const lunchSlots = generateTimeSlots(10, DEFAULT_SLEEP, SCHOOL_PERIOD_TEMPLATES[5], true);
  const checks = [
    getDateKey(new Date(2026, 3, 1)) === "2026-04-01",
    timeToMinutes("01:30") === 90,
    minutesToTime(90) === "01:30",
    getBlockRanges("23:00", "07:00").length === 2,
    generateTimeSlots(60, DEFAULT_SLEEP, DEFAULT_SCHOOL.schedule[1], true).every((slot) => typeof slot === "string"),
    buildCircleSegments({ "08:00": "공부" }, 60, DEFAULT_SLEEP, DEFAULT_SCHOOL.schedule[1], true, "학교").length > 0,
    !lunchSlots.includes("12:20"),
    !lunchSlots.includes("12:30"),
    !lunchSlots.includes("12:50"),
  ];
  return checks.every(Boolean);
}

function getMediaType(url: string) {
  const lower = url.toLowerCase();
  if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".ogg") || lower.includes("video")) return "video";
  return "image";
}

function getAutoMediaFit(viewportAspect: number | null, mediaAspect: number | null): Exclude<MediaFitMode, "auto"> {
  if (!viewportAspect || !mediaAspect) return "cover";
  return Math.abs(viewportAspect - mediaAspect) > 0.42 ? "contain" : "cover";
}

function hexToRgb(hex: string) {
  const safe = String(hex || "").trim();
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(safe);
  if (!match) return null;
  return { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) };
}

function getRelativeLuminance(r: number, g: number, b: number) {
  const normalize = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const rn = normalize(r);
  const gn = normalize(g);
  const bn = normalize(b);
  return 0.2126 * rn + 0.7152 * gn + 0.0722 * bn;
}

function getReadableTextColor(r: number, g: number, b: number) {
  return getRelativeLuminance(r, g, b) > 0.45 ? "#0f172a" : "#f8fafc";
}

function sampleAverageColorFromElement(element: HTMLImageElement | HTMLVideoElement) {
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 24;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(element, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha < 16) continue;
    r += pixels[i];
    g += pixels[i + 1];
    b += pixels[i + 2];
    count += 1;
  }
  if (!count) return null;
  return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
}

function sampleAverageColorFromImage(url: string) {
  return new Promise<{ r: number; g: number; b: number } | null>((resolve) => {
    const img = new window.Image();
    if (/^https?:\/\//i.test(url)) img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        resolve(sampleAverageColorFromElement(img));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function sampleAverageColorFromVideo(url: string) {
  return new Promise<{ r: number; g: number; b: number } | null>((resolve) => {
    const video = document.createElement("video");
    if (/^https?:\/\//i.test(url)) video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const finish = () => {
      try {
        resolve(sampleAverageColorFromElement(video));
      } catch {
        resolve(null);
      }
    };
    video.addEventListener("loadeddata", finish, { once: true });
    video.onerror = () => resolve(null);
    video.src = url;
  });
}

export default function WeeklyPlannerApp() {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState<"calendar" | "daily">("calendar");
  const [interval, setIntervalSize] = useState(60);
  const [mode, setMode] = useState<"table" | "circle">("table");
  const [circleZoom, setCircleZoom] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(today.getMonth());
  const [editingSchool, setEditingSchool] = useState(false);
  const [editingWeekday, setEditingWeekday] = useState<number>(1);
  const [showSettings, setShowSettings] = useState(false);
  const [sleep, setSleep] = useState<SleepState>(DEFAULT_SLEEP);
  const [school, setSchool] = useState<SchoolState>(DEFAULT_SCHOOL);
  const [plans, setPlans] = useState<PlansState>({});
  const [planSync, setPlanSync] = useState<PlanSyncState>(DEFAULT_PLAN_SYNC);
  const [profile, setProfile] = useState<ProfileType>(DEFAULT_PROFILE);
  const [interaction, setInteraction] = useState<InteractionState>(DEFAULT_INTERACTION);
  const [todos, setTodos] = useState<TodosState>({});
  const [newTodo, setNewTodo] = useState("");
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "reset">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [needsPasswordUpdate, setNeedsPasswordUpdate] = useState(false);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudReady, setCloudReady] = useState(!isSupabaseConfigured);
  const [decorTheme, setDecorTheme] = useState<DecorThemeState>(DEFAULT_DECOR_THEME);
  const [decorMedia, setDecorMedia] = useState<DecorMediaState>(DEFAULT_DECOR_MEDIA);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [holidayLoading, setHolidayLoading] = useState(false);
  const [holidayError, setHolidayError] = useState("");
  const [viewportAspect, setViewportAspect] = useState<number | null>(() => (typeof window !== "undefined" ? window.innerWidth / window.innerHeight : null));
  const [mediaAspect, setMediaAspect] = useState<number | null>(null);
  const [isTouchViewport, setIsTouchViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(hover: none), (pointer: coarse)").matches || window.innerWidth < 768;
  });
  const [monthDirection, setMonthDirection] = useState(1);
  const [allowEntryMotion, setAllowEntryMotion] = useState(false);
  const [dailyMessageIndex, setDailyMessageIndex] = useState(() => pickRandomIndex(DAILY_MESSAGES.length));
  const [dailyEntryOrigin, setDailyEntryOrigin] = useState({ x: 50, y: 50 });
  const [savePulse, setSavePulse] = useState(0);
  const [savePulseVisible, setSavePulseVisible] = useState(false);
  const [savePulseMessage, setSavePulseMessage] = useState("자동 저장됨");
  const audioContextRef = useRef<AudioContext | null>(null);
  const uploadedMediaObjectUrlRef = useRef<string | null>(null);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHydratedRef = useRef(false);
  const pendingSaveMessageRef = useRef<string | null>(null);
  const lastVibrationAtRef = useRef(0);
  const lastSavePulseAtRef = useRef(0);
  const latestPlannerStateRef = useRef<SavedState | null>(null);
  const plannerStateVersionRef = useRef(0);
  const plannerChangeSourceRef = useRef<"hydrate" | "user">("hydrate");
  const hasPlannerSnapshotRef = useRef(false);
  const sessionUserId = sessionUser?.id ?? null;

  const triggerSavePulse = useCallback((message = "자동 저장됨", options?: { force?: boolean }) => {
    const now = Date.now();
    const force = options?.force ?? false;
    if (!force && now - lastSavePulseAtRef.current < 20000) {
      return;
    }
    lastSavePulseAtRef.current = now;
    setSavePulseMessage(message);
    setSavePulse((prev) => prev + 1);
    setSavePulseVisible(true);
    if (savePulseTimeoutRef.current) clearTimeout(savePulseTimeoutRef.current);
    savePulseTimeoutRef.current = setTimeout(() => setSavePulseVisible(false), 1000);
  }, []);

  const buildSavedState = useCallback((updatedAt = Date.now()): SavedState => {
    const decorMediaForStorage: DecorMediaState = { ...decorMedia, uploadedMediaUrl: "", uploadedMediaType: "" };
    return {
      plans,
      todos,
      sleep,
      school,
      interval,
      decorTheme,
      decorMedia: decorMediaForStorage,
      decor: { ...decorTheme, ...decorMediaForStorage },
      planSync,
      profile,
      interaction,
      meta: { updatedAt },
    };
  }, [decorMedia, decorTheme, interaction, interval, planSync, plans, profile, school, sleep, todos]);
  const getCurrentSavedState = useEffectEvent(() => buildSavedState());

  const applySavedState = useCallback((saved: SavedState | null) => {
    if (!saved) return;
    plannerChangeSourceRef.current = "hydrate";
    setPlans(saved.plans || {});
    setTodos(saved.todos || {});
    setSleep(saved.sleep || DEFAULT_SLEEP);
    setSchool(saved.school || DEFAULT_SCHOOL);
    setIntervalSize(saved.interval || 60);
    const savedDecor = saved.decorTheme || saved.decorMedia ? { ...(saved.decorTheme || {}), ...(saved.decorMedia || {}) } : saved.decor;
    const splitDecor = splitDecorState(savedDecor);
    splitDecor.media.uploadedMediaUrl = "";
    splitDecor.media.uploadedMediaType = "";
    setDecorTheme(splitDecor.theme);
    setDecorMedia(splitDecor.media);
    setPlanSync({ ...DEFAULT_PLAN_SYNC, ...(saved.planSync || {}) });
    setProfile(saved.profile || DEFAULT_PROFILE);
    setInteraction({ ...DEFAULT_INTERACTION, ...(saved.interaction || {}) });
  }, []);

  useEffect(() => {
    latestPlannerStateRef.current = buildSavedState();
    if (!hasPlannerSnapshotRef.current) {
      hasPlannerSnapshotRef.current = true;
      plannerChangeSourceRef.current = "user";
      return;
    }
    if (plannerChangeSourceRef.current !== "hydrate") {
      plannerStateVersionRef.current += 1;
    }
    plannerChangeSourceRef.current = "user";
  }, [buildSavedState]);

  useEffect(() => {
    const saved = loadSavedPlanner();
    if (!saved) return;
    applySavedState(saved);
  }, [applySavedState]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buildSavedState()));
        if (hasHydratedRef.current) {
          triggerSavePulse(pendingSaveMessageRef.current || "자동 저장됨");
        } else {
          hasHydratedRef.current = true;
        }
        pendingSaveMessageRef.current = null;
      } catch {
        pendingSaveMessageRef.current = null;
      }
    }, 220);

    return () => {
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    };
  }, [buildSavedState, triggerSavePulse]);

  useEffect(() => {
    if (!supabase) {
      setAuthMessage("지금은 이 기기 저장만 쓰고 있어. Supabase를 연결하면 여러 기기에서도 이어서 쓸 수 있어.");
      return undefined;
    }

    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setAuthError(error.message);
        return;
      }
      setSessionUser(data.session?.user ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("reset");
        setNeedsPasswordUpdate(true);
        setShowSettings(true);
        setAuthMessage("새 비밀번호를 입력하면 바로 변경돼.");
      }
      setSessionUser(session?.user ?? null);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    if (!sessionUserId) {
      setCloudReady(true);
      setCloudSyncing(false);
      setAuthMessage("");
      return undefined;
    }

    let cancelled = false;
    const client = supabase;
    const userId = sessionUserId;
    const syncStartedAtVersion = plannerStateVersionRef.current;

    async function syncPlannerFromCloud() {
      setCloudSyncing(true);
      setCloudReady(false);
      setAuthError("");
      try {
        const localSaved = loadSavedPlanner();
        const remote = await fetchRemotePlannerState(client, userId);
        if (cancelled) return;

        const remoteSaved = (remote?.planner_state || null) as SavedState | null;
        const remoteUpdatedAt = getSavedStateUpdatedAt(remoteSaved) || (remote?.updated_at ? new Date(remote.updated_at).getTime() : 0);
        const hasLocalChangesDuringSync = plannerStateVersionRef.current !== syncStartedAtVersion;
        const currentSaved = latestPlannerStateRef.current || getCurrentSavedState();
        const localCandidate = hasLocalChangesDuringSync ? currentSaved : (localSaved || currentSaved);
        const localUpdatedAt = getSavedStateUpdatedAt(localCandidate);

        if (remoteSaved && remoteUpdatedAt > localUpdatedAt) {
          applySavedState(remoteSaved);
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteSaved));
          setAuthMessage("계정에 저장된 최신 데이터를 불러왔어.");
        } else {
          const snapshotToUpload = localCandidate;
          const uploadUpdatedAt = getSavedStateUpdatedAt(snapshotToUpload) || Date.now();
          await saveRemotePlannerState(client, userId, snapshotToUpload, uploadUpdatedAt);
          if (cancelled) return;
          setAuthMessage(localSaved ? "이 기기 데이터를 계정에 동기화했어." : "새 계정 저장 공간을 준비해뒀어.");
        }
      } catch (error) {
        if (cancelled) return;
        setAuthError(error instanceof Error ? error.message : "클라우드 동기화 중 문제가 생겼어.");
      } finally {
        if (!cancelled) {
          setCloudSyncing(false);
          setCloudReady(true);
        }
      }
    }

    void syncPlannerFromCloud();

    return () => {
      cancelled = true;
    };
  }, [applySavedState, sessionUserId]);

  useEffect(() => {
    if (!supabase || !sessionUserId || !cloudReady) return undefined;
    if (cloudSaveTimeoutRef.current) clearTimeout(cloudSaveTimeoutRef.current);
    const client = supabase;
    const userId = sessionUserId;

    cloudSaveTimeoutRef.current = setTimeout(() => {
      const snapshot = buildSavedState();
      const updatedAt = getSavedStateUpdatedAt(snapshot) || Date.now();
      saveRemotePlannerState(client, userId, snapshot, updatedAt)
        .then(() => setAuthMessage("계정에도 자동 저장됐어."))
        .catch((error) => setAuthError(error instanceof Error ? error.message : "계정 저장에 실패했어."));
    }, 900);

    return () => {
      if (cloudSaveTimeoutRef.current) clearTimeout(cloudSaveTimeoutRef.current);
    };
  }, [buildSavedState, cloudReady, sessionUserId]);

  useEffect(() => {
    if (!supabase || !sessionUser || !cloudReady || decorTheme.themePreset !== "custom") return undefined;
    if (decorMedia.cloudMediaPath || decorMedia.mediaUrl) return undefined;

    let cancelled = false;
    const client = supabase;
    const user = sessionUser;

    loadUploadedMediaFromDb()
      .then(async (result) => {
        if (!result || cancelled) return;
        const extension = result.uploadedMediaType === "video" ? "mp4" : "png";
        const file = new File([result.blob], `planner-background.${extension}`, {
          type: result.blob.type || (result.uploadedMediaType === "video" ? "video/mp4" : "image/png"),
        });
        const { path, publicUrl } = await uploadPlannerBackground(client, user.id, file, result.uploadedMediaType);
        if (cancelled) return;
        setDecorMedia((prev) => ({ ...prev, mediaUrl: publicUrl, cloudMediaPath: path }));
        setAuthMessage("이 기기의 배경도 계정에 연결했어.");
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [cloudReady, decorMedia.cloudMediaPath, decorMedia.mediaUrl, decorTheme.themePreset, sessionUser]);

  useEffect(() => {
    let cancelled = false;
    const year = currentDate.getFullYear();

    async function fetchHolidays() {
      setHolidayLoading(true);
      setHolidayError("");
      try {
        const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`);
        if (!response.ok) throw new Error("holiday fetch failed");
        const data = (await response.json()) as HolidayItem[];
        if (cancelled) return;
        const mapped = Object.fromEntries(data.map((item) => [item.date, item.localName || item.name || "공휴일"]));
        setHolidays(mapped);
      } catch {
        if (!cancelled) setHolidayError("공휴일 정보를 불러오지 못했어.");
      } finally {
        if (!cancelled) setHolidayLoading(false);
      }
    }

    fetchHolidays();
    return () => {
      cancelled = true;
    };
  }, [currentDate]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const updateInteractionViewport = () => {
      const coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)").matches;
      setIsTouchViewport(coarsePointer || window.innerWidth < 768);
    };

    updateInteractionViewport();
    window.addEventListener("resize", updateInteractionViewport);
    return () => window.removeEventListener("resize", updateInteractionViewport);
  }, []);

  useEffect(() => {
    setAllowEntryMotion(true);
  }, []);

  const playClickSound = useCallback(() => {
    try {
      if (typeof window === "undefined" || !interaction.soundEnabled) return;
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) audioContextRef.current = new AudioCtx();
      const ctx = audioContextRef.current;
      const emitBeep = () => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const strength = interaction.feedbackStrength;
        const duration = 0.04 + strength * 0.05;
        const gainAmount = 0.009 + strength * 0.026;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(660 + strength * 120, ctx.currentTime);
        gain.gain.setValueAtTime(gainAmount, ctx.currentTime);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        oscillator.start(now);
        oscillator.stop(now + duration);
      };

      if (ctx.state === "suspended") {
        void ctx.resume().then(emitBeep).catch(() => undefined);
        return;
      }

      emitBeep();
    } catch {
      // no-op
    }
  }, [interaction.feedbackStrength, interaction.soundEnabled]);

  const triggerVibration = useCallback(() => {
    try {
      if (typeof window === "undefined" || !interaction.vibrationEnabled || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
      const now = Date.now();
      if (now - lastVibrationAtRef.current < 45) return;
      lastVibrationAtRef.current = now;
      const duration = Math.round(10 + interaction.feedbackStrength * 22);
      navigator.vibrate(duration);
    } catch {
      // no-op
    }
  }, [interaction.feedbackStrength, interaction.vibrationEnabled]);

  const triggerInteractionFeedback = useCallback(() => {
    playClickSound();
    triggerVibration();
  }, [playClickSound, triggerVibration]);

  const press = useCallback((fn: () => void) => {
    triggerInteractionFeedback();
    fn();
  }, [triggerInteractionFeedback]);

  const toggleSoundFeedback = () => {
    setInteraction((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  };

  const toggleVibrationFeedback = () => {
    setInteraction((prev) => ({ ...prev, vibrationEnabled: !prev.vibrationEnabled }));
  };

  const updateFeedbackStrength = (value: number) => {
    setInteraction((prev) => ({ ...prev, feedbackStrength: value }));
  };

  const handleAuthSubmit = async () => {
    if (!supabase) {
      setAuthError("Supabase 설정이 아직 없어서 로그인은 아직 연결되지 않았어.");
      return;
    }
    if (authMode === "reset" && needsPasswordUpdate) {
      if (!authPassword.trim()) {
        setAuthError("새 비밀번호를 입력해줘.");
        return;
      }
      if (authPassword !== authConfirmPassword) {
        setAuthError("비밀번호 확인이 일치하지 않아.");
        return;
      }
    } else if (authMode === "reset" && !needsPasswordUpdate) {
      if (!authEmail.trim()) {
        setAuthError("비밀번호를 재설정할 이메일을 입력해줘.");
        return;
      }
    } else if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError("이메일과 비밀번호를 모두 입력해줘.");
      return;
    }
    if (authMode === "signup" && authPassword !== authConfirmPassword) {
      setAuthError("비밀번호 확인이 일치하지 않아.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");
    try {
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
        });
        if (error) throw error;
        setAuthMessage("회원가입을 보냈어. 메일 인증이 켜져 있으면 받은편지함을 확인해줘.");
      } else if (authMode === "reset") {
        if (needsPasswordUpdate) {
          const { error } = await supabase.auth.updateUser({ password: authPassword });
          if (error) throw error;
          setNeedsPasswordUpdate(false);
          setAuthMode("signin");
          setAuthMessage("비밀번호를 새로 바꿨어. 이제 새 비밀번호로 로그인하면 돼.");
        } else {
          const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
          const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim(), redirectTo ? { redirectTo } : undefined);
          if (error) throw error;
          setAuthMessage("비밀번호 재설정 메일을 보냈어. 메일의 링크를 눌러서 새 비밀번호를 정해줘.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });
        if (error) throw error;
        setAuthMessage("로그인됐어. 이제 여러 기기에서 이어서 쓸 수 있어.");
      }
      setAuthPassword("");
      setAuthConfirmPassword("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "로그인 중 문제가 생겼어.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setNeedsPasswordUpdate(false);
      setAuthMode("signin");
      setAuthMessage("이 기기에서는 로그아웃했어. 로컬 저장은 그대로 남아 있어.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "로그아웃 중 문제가 생겼어.");
    } finally {
      setAuthLoading(false);
    }
  };

  const applyUploadedMediaPreview = (blob: Blob | null, uploadedMediaType: "image" | "video" | "") => {
    if (uploadedMediaObjectUrlRef.current) {
      URL.revokeObjectURL(uploadedMediaObjectUrlRef.current);
      uploadedMediaObjectUrlRef.current = null;
    }

    if (!blob || !uploadedMediaType) {
      setDecorMedia((prev) => ({ ...prev, uploadedMediaUrl: "", uploadedMediaType: "" }));
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    uploadedMediaObjectUrlRef.current = objectUrl;
    setDecorMedia((prev) => ({ ...prev, uploadedMediaUrl: objectUrl, uploadedMediaType }));
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const uploadedMediaType = file.type.startsWith("video/") ? "video" : "image";
      await saveUploadedMediaToDb(file, uploadedMediaType);
      applyUploadedMediaPreview(file, uploadedMediaType);
      if (supabase && sessionUser) {
        const { path, publicUrl } = await uploadPlannerBackground(
          supabase,
          sessionUser.id,
          file,
          uploadedMediaType,
          decorMedia.cloudMediaPath || undefined,
        );
        setDecorMedia((prev) => ({
          ...prev,
          mediaUrl: publicUrl,
          cloudMediaPath: path,
        }));
        pendingSaveMessageRef.current = "배경이 계정에도 저장됐어";
      } else {
        pendingSaveMessageRef.current = "배경이 저장됐어";
      }
    } catch {
      pendingSaveMessageRef.current = "배경 저장 중 문제가 있었어";
    }
    event.target.value = "";
  };

  const clearBackgroundMedia = async () => {
    pendingSaveMessageRef.current = "배경 설정이 저장됐어";
    if (supabase && sessionUser && decorMedia.cloudMediaPath) {
      await removePlannerBackground(supabase, decorMedia.cloudMediaPath).catch(() => undefined);
    }
    clearUploadedMediaFromDb().catch(() => undefined);
    applyUploadedMediaPreview(null, "");
    setDecorMedia((prev) => ({ ...prev, mediaUrl: "", cloudMediaPath: "", uploadedMediaUrl: "", uploadedMediaType: "" }));
  };

  const resetDecorSettings = () => {
    pendingSaveMessageRef.current = "기본 설정으로 돌아갔어";
    clearUploadedMediaFromDb().catch(() => undefined);
    applyUploadedMediaPreview(null, "");
    setDecorTheme(DEFAULT_DECOR_THEME);
    setDecorMedia(DEFAULT_DECOR_MEDIA);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const yearOptions = useMemo(() => buildYearOptions(year), [year]);
  const monthLabels = useMemo(() => Array.from({ length: 12 }, (_, index) => `${index + 1}월`), []);
  const { cells } = useMemo(() => getMonthData(year, month), [year, month]);
  const selectedKey = getDateKey(selectedDate);
  const weekday = selectedDate.getDay();
  const selectedPlanKey = getPlanKey(selectedDate, planSync.byWeekday);
  const rawScheduleBlocks = useMemo(() => school.schedule[weekday] || [], [school.schedule, weekday]);
  const showSchedule = profile !== "none";
  const isWorker = profile === "worker";
  const scheduleLabel = isWorker ? "회사" : "학교";
  const scheduleTimeLabel = isWorker ? "회사 시간" : "학교 시간";
  const scheduleSummaryLabel = isWorker ? "오늘 회사 시간" : "오늘 학교 시간";
  const scheduleEditorLabel = isWorker ? "회사 시간 설정" : "시간 설정";
  const scheduleEnabled = showSchedule && school.enabled;
  const scheduleBlocks = useMemo(() => (showSchedule && rawScheduleBlocks.length > 0 ? [rawScheduleBlocks[0]] : []), [rawScheduleBlocks, showSchedule]);
  const currentScheduleText = scheduleEnabled ? (scheduleBlocks.length > 0 ? `${scheduleBlocks[0].start} ~ ${scheduleBlocks[0].end}` : "설정 없음") : "꺼짐";
  const sanityPassed = useMemo(() => runPlannerSanityChecks(), []);
  const decor = useMemo(() => ({ ...decorTheme, ...decorMedia }), [decorMedia, decorTheme]);
  const activeMediaUrl = decorMedia.uploadedMediaUrl || decorMedia.mediaUrl;
  const mediaType = useMemo(() => {
    if (decorMedia.uploadedMediaUrl && decorMedia.uploadedMediaType) return decorMedia.uploadedMediaType;
    return getMediaType(activeMediaUrl);
  }, [activeMediaUrl, decorMedia.uploadedMediaType, decorMedia.uploadedMediaUrl]);
  const resolvedMediaFit = useMemo<Exclude<MediaFitMode, "auto">>(() => {
    if (decorMedia.mediaFit !== "auto") return decorMedia.mediaFit;
    return getAutoMediaFit(viewportAspect, mediaAspect);
  }, [decorMedia.mediaFit, mediaAspect, viewportAspect]);
  const panelTheme = useMemo(() => buildPanelTheme(decorTheme.panelOpacity, decorTheme.panelColor), [decorTheme.panelColor, decorTheme.panelOpacity]);
  const motionEase = useMemo(() => [0.22, 1, 0.36, 1] as const, []);
  const buttonMotionProps = useMemo(
    () => ({
      whileTap: { scale: isTouchViewport ? 0.985 : 0.95 },
      whileHover: isTouchViewport ? undefined : { scale: 0.985 },
      transition: { duration: isTouchViewport ? 0.1 : 0.14, ease: motionEase },
    }),
    [isTouchViewport, motionEase],
  );
  const calendarViewMotion = isTouchViewport
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12, ease: motionEase },
      }
    : {
        initial: { x: -80, opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: 80, opacity: 0 },
        transition: { duration: 0.16, ease: motionEase },
      };
  const dailyViewMotion = isTouchViewport
    ? {
        initial: { opacity: 0, y: 10, scale: 0.995 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -8, scale: 0.998 },
        transition: { duration: 0.12, ease: motionEase },
      }
    : {
        initial: { opacity: 0, scale: 0.97, y: 20, filter: "blur(6px)" },
        animate: { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 0, scale: 0.99, y: -14, filter: "blur(4px)" },
        transition: { duration: 0.16, ease: motionEase },
      };
  const settingsPanelMotion = isTouchViewport
    ? {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 10 },
        transition: { duration: 0.12, ease: motionEase },
      }
    : {
        initial: { opacity: 0, y: 20, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 20, scale: 0.98 },
        transition: { duration: 0.16, ease: motionEase },
      };
  const dailyTodos = todos[selectedKey] || [];
  const completedTodos = dailyTodos.filter((item) => item.done).length;
  const pendingTodos = dailyTodos.length - completedTodos;
  const completionRate = dailyTodos.length ? Math.round((completedTodos / dailyTodos.length) * 100) : 0;
  const importantTodos = dailyTodos.filter((item) => item.important && !item.done);
  const todoPanelLabels = useMemo(() => getTodoPanelLabels(selectedDate), [selectedDate]);
  const activeDailyMessage = DAILY_MESSAGES[dailyMessageIndex] || DAILY_MESSAGES[0];
  const selectedHolidayName = holidays[selectedKey] || getFallbackKrHolidayName(selectedDate);

  const selectedPlans = useMemo(() => plans[selectedPlanKey] || {}, [plans, selectedPlanKey]);
  const timeSlots = useMemo(() => generateTimeSlots(interval, sleep, scheduleBlocks, scheduleEnabled), [interval, sleep, scheduleBlocks, scheduleEnabled]);
  const circleSegments = useMemo(
    () => buildCircleSegments(selectedPlans, interval, sleep, scheduleBlocks, scheduleEnabled, scheduleLabel),
    [interval, scheduleBlocks, scheduleEnabled, scheduleLabel, selectedPlans, sleep],
  );

  const updatePlan = (time: string, value: string) => {
    setPlans((prev) => ({ ...prev, [selectedPlanKey]: { ...(prev[selectedPlanKey] || {}), [time]: value } }));
  };

  const addTodo = () => {
    if (!newTodo.trim()) return;
    const item: TodoItem = { id: `${Date.now()}-${Math.random()}`, text: newTodo.trim(), important: false, done: false };
    setTodos((prev) => ({ ...prev, [selectedKey]: [...(prev[selectedKey] || []), item] }));
    setNewTodo("");
  };

  const toggleTodoDone = (id: string) => {
    setTodos((prev) => ({
      ...prev,
      [selectedKey]: (prev[selectedKey] || []).map((item) => {
        if (item.id !== id) return item;
        const nextDone = !item.done;
        return { ...item, done: nextDone, important: nextDone ? false : item.important };
      }),
    }));
  };

  const toggleImportantTodo = (id: string) => {
    setTodos((prev) => ({
      ...prev,
      [selectedKey]: (prev[selectedKey] || []).map((item) => (item.id === id ? { ...item, important: !item.important } : item)),
    }));
  };

  const removeTodo = (id: string) => {
    setTodos((prev) => ({ ...prev, [selectedKey]: (prev[selectedKey] || []).filter((item) => item.id !== id) }));
  };

  const clearCompletedTodos = () => {
    setTodos((prev) => ({
      ...prev,
      [selectedKey]: (prev[selectedKey] || []).filter((item) => !item.done),
    }));
  };

  const toggleWeekdaySync = () => {
    const nextEnabled = !planSync.byWeekday;
    if (nextEnabled) {
      const weekdayKey = getWeekdayPlanKey(selectedDate);
      setPlans((prev) => {
        if (prev[weekdayKey] && Object.keys(prev[weekdayKey]).length > 0) return prev;
        const currentDayPlans = prev[selectedKey];
        if (!currentDayPlans) return prev;
        return { ...prev, [weekdayKey]: { ...currentDayPlans } };
      });
    }
    setPlanSync({ byWeekday: nextEnabled });
  };

  const updateScheduleBlock = (day: number, field: "start" | "end", value: string) => {
    setSchool((prev) => {
      const current = prev.schedule[day]?.[0] || { start: "09:00", end: "18:00" };
      return {
        ...prev,
        schedule: { ...prev.schedule, [day]: [{ ...current, [field]: value }] },
      };
    });
  };

  const clearScheduleBlock = (day: number) => {
    setSchool((prev) => ({
      ...prev,
      schedule: { ...prev.schedule, [day]: [] },
    }));
  };

  const navigateMonth = (direction: -1 | 1) => {
    press(() => {
      setMonthDirection(direction);
      setCurrentDate(new Date(year, month + direction, 1));
    });
  };

  const openMonthPicker = () => {
    press(() => {
      setPickerYear(year);
      setPickerMonth(month);
      setShowMonthPicker(true);
    });
  };

  const jumpToYearMonth = (nextYear: number, nextMonth: number) => {
    press(() => {
      const direction = nextYear > year || (nextYear === year && nextMonth >= month) ? 1 : -1;
      setMonthDirection(direction);
      setCurrentDate(new Date(nextYear, nextMonth, 1));
      setShowMonthPicker(false);
    });
  };

  const openDailyFromCalendar = (date: Date, originX: number, originY: number) => {
    press(() => {
      setDailyEntryOrigin({ x: originX, y: originY });
      setSelectedDate(date);
      setView("daily");
    });
  };

  const isNarrowViewport = (viewportAspect ?? 1) < 0.82;
  const circleSize = circleZoom ? (isNarrowViewport ? 300 : 620) : (isNarrowViewport ? 228 : 340);
  const radius = circleZoom ? (isNarrowViewport ? 112 : 244) : (isNarrowViewport ? 86 : 130);
  const center = circleSize / 2;
  const panelBg = panelTheme.root;
  const strongPanelBg = panelTheme.strong;
  const softPanelBg = panelTheme.card;
  const mutedPanelBg = panelTheme.muted;
  const panelBorderStyle = { borderColor: panelTheme.border };
  const isPhoneViewport = (viewportAspect ?? 1) < 0.8;
  const pcRatioHint = useMemo(() => {
    if (!viewportAspect) return "16:9 (예: 1920x1080)";
    if (viewportAspect >= 1.74) return "16:9 (예: 1920x1080)";
    if (viewportAspect >= 1.58) return "16:10 (예: 1920x1200)";
    return "3:2 (예: 2160x1440)";
  }, [viewportAspect]);
  const backgroundRatioHint = useMemo(() => {
    if (isPhoneViewport) return "핸드폰 최적화는 9:16 세로 비율이 가장 자연스러워.";
    return `PC 권장 비율은 ${pcRatioHint} 정도야. 자동 비율 맞춤을 켜두면 화면에 맞게 조절돼.`;
  }, [isPhoneViewport, pcRatioHint]);

  const planEntries = useMemo(() => getColoredPlanEntries(selectedPlans), [selectedPlans]);
  const morningEntries = useMemo(() => planEntries.filter((entry) => timeToMinutes(entry.time) < 12 * 60), [planEntries]);
  const afternoonEntries = useMemo(() => planEntries.filter((entry) => timeToMinutes(entry.time) >= 12 * 60), [planEntries]);
  const morningMixColor = useMemo(() => mixColors(morningEntries.map((entry) => entry.color)), [morningEntries]);
  const afternoonMixColor = useMemo(() => mixColors(afternoonEntries.map((entry) => entry.color)), [afternoonEntries]);
  const morningMixBackground = useMemo(() => buildMixedDotBackground(morningEntries.map((entry) => entry.color)), [morningEntries]);
  const afternoonMixBackground = useMemo(() => buildMixedDotBackground(afternoonEntries.map((entry) => entry.color)), [afternoonEntries]);

  useEffect(() => {
    if (view !== "daily") return;
    setDailyMessageIndex((prev) => pickRandomIndex(DAILY_MESSAGES.length, prev));
  }, [selectedKey, view]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncViewportAspect = () => setViewportAspect(window.innerWidth / window.innerHeight);
    syncViewportAspect();
    window.addEventListener("resize", syncViewportAspect);
    return () => window.removeEventListener("resize", syncViewportAspect);
  }, []);

  useEffect(() => {
    if (!activeMediaUrl) {
      setMediaAspect(null);
      return;
    }

    if (mediaType === "image") {
      const img = new window.Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) setMediaAspect(img.naturalWidth / img.naturalHeight);
      };
      img.onerror = () => setMediaAspect(null);
      img.src = activeMediaUrl;
      return;
    }

    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (video.videoWidth && video.videoHeight) setMediaAspect(video.videoWidth / video.videoHeight);
    };
    video.onerror = () => setMediaAspect(null);
    video.src = activeMediaUrl;
  }, [activeMediaUrl, mediaType]);

  useEffect(() => {
    let cancelled = false;

    if (decorMedia.uploadedMediaUrl || decorMedia.mediaUrl || decorMedia.cloudMediaPath) {
      return () => {
        cancelled = true;
        if (savePulseTimeoutRef.current) clearTimeout(savePulseTimeoutRef.current);
        if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
        if (cloudSaveTimeoutRef.current) clearTimeout(cloudSaveTimeoutRef.current);
      };
    }

    loadUploadedMediaFromDb()
      .then((result) => {
        if (!result || cancelled) return;
        applyUploadedMediaPreview(result.blob, result.uploadedMediaType);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (uploadedMediaObjectUrlRef.current) {
        URL.revokeObjectURL(uploadedMediaObjectUrlRef.current);
        uploadedMediaObjectUrlRef.current = null;
      }
      if (savePulseTimeoutRef.current) clearTimeout(savePulseTimeoutRef.current);
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
      if (cloudSaveTimeoutRef.current) clearTimeout(cloudSaveTimeoutRef.current);
    };
  }, [decorMedia.cloudMediaPath, decorMedia.mediaUrl, decorMedia.uploadedMediaUrl]);

  useEffect(() => {
    let cancelled = false;

    async function syncAutoCalendarColor() {
      let sampled = null as { r: number; g: number; b: number } | null;
      if (activeMediaUrl) {
        sampled = mediaType === "image" ? await sampleAverageColorFromImage(activeMediaUrl) : await sampleAverageColorFromVideo(activeMediaUrl);
      }
      if (!sampled) sampled = hexToRgb(decorTheme.backgroundColor);
      if (!sampled || cancelled) return;

      const nextTextColor = getReadableTextColor(sampled.r, sampled.g, sampled.b);
      setDecorTheme((prev) => {
        if (prev.textColor === nextTextColor) return prev;
        return { ...prev, textColor: nextTextColor };
      });
    }

    syncAutoCalendarColor();
    return () => {
      cancelled = true;
    };
  }, [activeMediaUrl, decorTheme.backgroundColor, mediaType]);

  useEffect(() => {
    if (showSchedule) return;
    setEditingSchool(false);
  }, [showSchedule]);

  return (
    <div className="relative overflow-x-hidden" style={{ color: decor.textColor, backgroundColor: decor.backgroundColor, minHeight: "100dvh" }}>
      <div className="absolute inset-0" style={{ backgroundColor: decor.backgroundColor }} />
      {activeMediaUrl && mediaType === "image" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={activeMediaUrl}
            alt=""
            className={`h-full w-full ${resolvedMediaFit === "cover" ? "object-cover" : "object-contain"}`}
          />
        </div>
      )}
      {activeMediaUrl && mediaType === "video" && (
        <video
          className={`absolute inset-0 h-full w-full ${resolvedMediaFit === "cover" ? "object-cover" : "object-contain"}`}
          src={activeMediaUrl}
          autoPlay
          muted
          loop
          playsInline
        />
      )}
      <div className="absolute inset-0" style={{ background: `rgba(15, 23, 42, ${decor.overlayOpacity})` }} />

      <div
        className="relative z-10 flex h-[100dvh] flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
      >
        {!sanityPassed && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">내부 검사에서 문제가 감지됐어. 시간 계산 함수를 다시 확인해줘.</div>}

        <AnimatePresence mode="wait">
          {view === "calendar" ? (
            <motion.div
              key="calendar"
              initial={allowEntryMotion ? calendarViewMotion.initial : false}
              animate={calendarViewMotion.animate}
              exit={calendarViewMotion.exit}
              transition={calendarViewMotion.transition}
              className="flex-1"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${year}-${month}`}
                  custom={monthDirection}
                  variants={monthSlideVariants}
                  initial={allowEntryMotion ? "enter" : false}
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full"
                >
              <Card className={`flex flex-col rounded-none border-0 shadow-none ${panelTheme.blurClass}`} style={{ background: panelBg, minHeight: "100dvh" }}>
                <CardHeader className="relative items-center px-3 pb-3 pt-5 text-center sm:px-6 sm:pb-4">
                  <div className="absolute left-4 top-1/2 flex -translate-y-1/2 gap-2">
                    <motion.div {...buttonMotionProps}>
                      <Button variant="outline" className="backdrop-blur-md" style={{ background: strongPanelBg, borderColor: panelTheme.border }} onClick={() => navigateMonth(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  </div>
                  <motion.div {...buttonMotionProps} className="mx-auto">
                    <button
                      type="button"
                      onClick={openMonthPicker}
                      className="rounded-2xl px-4 py-2 text-center transition-colors hover:bg-white/20 active:bg-white/25"
                      aria-label="연도와 월 빠르게 선택"
                    >
                      <CardTitle className="text-2xl font-bold sm:text-3xl">{year}년 {month + 1}월</CardTitle>
                    </button>
                  </motion.div>
                  <div className="absolute right-4 top-1/2 flex -translate-y-1/2 gap-2">
                    <motion.div {...buttonMotionProps}>
                      <Button variant="outline" className="backdrop-blur-md" style={{ background: strongPanelBg, borderColor: panelTheme.border }} onClick={() => navigateMonth(1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col px-3 pb-24 sm:px-4 md:px-6 md:pb-6">
                  <div className="mb-3 grid grid-cols-7 text-center text-sm font-bold sm:text-xl md:text-2xl">
                    {weekDays.map((day, index) => <div key={day} className={index === 0 ? "text-red-500" : ""}>{day}</div>)}
                  </div>
                  {holidayLoading && <div className="mb-2 text-center text-xs opacity-70">공휴일 불러오는 중...</div>}
                  {holidayError && <div className="mb-2 text-center text-xs text-red-300">{holidayError}</div>}

                  <div className="grid flex-1 grid-cols-7 gap-2">
                    {cells.map((day, index) => {
                      if (!day) return <div key={index} className="min-h-[72px] rounded-2xl sm:min-h-[96px]" />;
                      const date = new Date(year, month, day);
                      const key = getDateKey(date);
                      const isSunday = date.getDay() === 0;
                      const holidayName = holidays[key] || getFallbackKrHolidayName(date);
                      const isHoliday = Boolean(holidayName);
                      const dayTodos = (todos[key] || []).filter((item) => item.text.trim() && !item.done);
                      const importantCount = dayTodos.filter((item) => item.important).length;
                      const topIndicators = isHoliday ? Array.from({ length: Math.min(importantCount, 3) }, (_, idx) => `top-star-${idx}`) : [];
                      const bottomStars = !isHoliday ? Array.from({ length: Math.min(importantCount, 3) }, (_, idx) => `bottom-star-${idx}`) : [];
                      const holidayEmoji = holidayName ? getHolidayEmoji(holidayName) : "";

                      return (
                        <motion.button
                          key={index}
                          whileTap={{ scale: isTouchViewport ? 0.995 : 0.985 }}
                          whileHover={isTouchViewport ? undefined : { scale: 0.99 }}
                          transition={{ duration: isTouchViewport ? 0.08 : 0.12, ease: motionEase }}
                          onClick={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            const originX = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
                            const originY = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
                            openDailyFromCalendar(date, originX, originY);
                          }}
                          className={`min-h-[78px] rounded-2xl border p-2 text-left shadow-sm transition sm:min-h-[104px] sm:p-3 ${panelTheme.blurClass}`}
                          style={{ background: softPanelBg, borderColor: panelTheme.border }}
                        >
                          <div className="flex h-full min-h-[62px] flex-col justify-between sm:min-h-[82px]">
                            <div className="flex min-h-[14px] items-start justify-start">
                              {topIndicators.length > 0 && (
                                <div className="flex flex-wrap gap-0.5 text-[11px] leading-none text-amber-500 sm:text-xs">
                                  {topIndicators.map((starKey) => <span key={starKey}>★</span>)}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-1 items-center justify-center sm:flex-none sm:items-start sm:justify-start">
                              <div className={`min-w-[1.5em] text-center text-lg font-bold md:text-2xl ${isSunday || isHoliday ? "text-red-500" : ""}`}>{day}</div>
                            </div>

                            <div className="flex min-h-[18px] items-end justify-start gap-1 text-sm leading-none sm:min-h-[20px]">
                              {holidayEmoji ? <span title={holidayName} className="text-[15px] sm:text-base">{holidayEmoji}</span> : null}
                              {bottomStars.length > 0 && (
                                <div className="flex flex-wrap gap-0.5 text-[11px] leading-none text-amber-500 sm:text-xs">
                                  {bottomStars.map((starKey) => <span key={starKey}>★</span>)}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="daily"
              initial={allowEntryMotion ? dailyViewMotion.initial : false}
              animate={dailyViewMotion.animate}
              exit={dailyViewMotion.exit}
              transition={dailyViewMotion.transition}
              style={{ transformOrigin: `${dailyEntryOrigin.x}% ${dailyEntryOrigin.y}%` }}
              className="min-h-[100dvh] flex-1 space-y-4 p-3 pb-28 sm:p-4 md:p-6"
            >
              <motion.div {...buttonMotionProps} className="inline-block">
                <Button variant="outline" className="backdrop-blur-md" style={{ background: strongPanelBg, borderColor: panelTheme.border }} onClick={() => press(() => setView("calendar"))}>← 달력</Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: isTouchViewport ? 10 : 16, scale: isTouchViewport ? 1 : 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: isTouchViewport ? 0.12 : 0.16, delay: isTouchViewport ? 0.01 : 0.02, ease: motionEase }}
              >
              <Card className={`mx-auto w-full max-w-[1600px] rounded-[26px] border shadow-2xl ${panelTheme.blurClass} sm:rounded-[30px]`} style={{ ...panelBorderStyle, background: panelBg }}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <CardTitle className="text-xl font-bold sm:text-2xl">
                      {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({weekDays[selectedDate.getDay()]}요일)
                      {planSync.byWeekday ? " · 요일 동기화" : ""}
                    </CardTitle>
                    {selectedHolidayName ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-red-50/90 px-3 py-1 text-sm font-semibold text-red-600">
                        <span className="text-base leading-none">{getHolidayEmoji(selectedHolidayName)}</span>
                        <span>{selectedHolidayName}</span>
                      </div>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 sm:space-y-5">
                  <div className={`grid gap-3 ${showSchedule ? "xl:grid-cols-2" : ""}`}>
                    <div className="space-y-3 rounded-2xl border p-3 backdrop-blur-md" style={{ ...panelBorderStyle, background: softPanelBg }}>
                      <div className="text-sm font-semibold">수면 시간</div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <motion.div {...buttonMotionProps}><Button variant={sleep.enabled ? "default" : "outline"} className="w-full rounded-xl sm:w-auto" onClick={() => press(() => setSleep({ ...sleep, enabled: !sleep.enabled }))}>수면</Button></motion.div>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:flex-1 sm:items-center">
                          <Input type="time" value={sleep.start} onChange={(e) => setSleep({ ...sleep, start: e.target.value })} />
                          <span className="text-center">~</span>
                          <Input type="time" value={sleep.end} onChange={(e) => setSleep({ ...sleep, end: e.target.value })} />
                        </div>
                      </div>
                    </div>

                    {showSchedule && (
                      <div className="space-y-3 rounded-2xl border p-3 backdrop-blur-md" style={{ ...panelBorderStyle, background: softPanelBg }}>
                        <div className="text-sm font-semibold">{scheduleTimeLabel}</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <motion.div {...buttonMotionProps}><Button variant={scheduleEnabled ? "default" : "outline"} className="rounded-xl" onClick={() => press(() => setSchool({ ...school, enabled: !school.enabled }))}>{scheduleLabel}</Button></motion.div>
                          <motion.div {...buttonMotionProps}><Button variant={editingSchool ? "default" : "outline"} className="rounded-xl" onClick={() => press(() => setEditingSchool((prev) => !prev))}>{scheduleEditorLabel}</Button></motion.div>
                        </div>
                        <div className="rounded-xl border p-3 text-sm" style={{ ...panelBorderStyle, background: mutedPanelBg }}>
                          <div className="mb-1 text-xs opacity-70">{scheduleSummaryLabel}</div>
                          <div className="font-medium">{currentScheduleText}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <AnimatePresence>
                    {showSchedule && editingSchool && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: isTouchViewport ? 0.12 : 0.16, ease: motionEase }} className="overflow-hidden">
                        <div className="space-y-4 rounded-2xl border p-4 backdrop-blur-md" style={{ ...panelBorderStyle, background: softPanelBg }}>
                          <div className="flex flex-wrap gap-2">
                            {WEEKDAY_EDIT_OPTIONS.map((dayIndex) => (
                              <motion.div key={`weekday-${dayIndex}`} {...buttonMotionProps}>
                                <Button variant={editingWeekday === dayIndex ? "default" : "outline"} onClick={() => press(() => setEditingWeekday(dayIndex))} className="rounded-xl">
                                  {weekDays[dayIndex]}
                                </Button>
                              </motion.div>
                            ))}
                          </div>
                          {(school.schedule[editingWeekday] || []).length === 0 ? <div className="text-sm opacity-70">아직 설정된 {scheduleTimeLabel}이 없어</div> : null}
                          <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center">
                            <Input type="time" value={school.schedule[editingWeekday]?.[0]?.start || (isWorker ? "09:00" : "08:30")} onChange={(e) => updateScheduleBlock(editingWeekday, "start", e.target.value)} />
                            <span className="text-center">~</span>
                            <Input type="time" value={school.schedule[editingWeekday]?.[0]?.end || (isWorker ? "18:00" : "16:30")} onChange={(e) => updateScheduleBlock(editingWeekday, "end", e.target.value)} />
                            <motion.div {...buttonMotionProps}>
                              <Button variant="outline" size="icon" className="w-full sm:w-9" onClick={() => press(() => clearScheduleBlock(editingWeekday))}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </motion.div>
                          </div>
                          <div className="text-xs opacity-70">주말은 제외하고 월요일부터 금요일까지만 설정돼.</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.9fr)]">
                    <div className="rounded-2xl border p-4 backdrop-blur-md" style={{ ...panelBorderStyle, background: softPanelBg }}>
                      <div className="mb-3 text-sm font-semibold">{todoPanelLabels.title}</div>
                      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                        <Input value={newTodo} onChange={(e) => setNewTodo(e.target.value)} placeholder="할 일을 추가해줘" onKeyDown={(e) => e.key === "Enter" && addTodo()} />
                        <Button className="w-full sm:w-auto" onClick={() => press(addTodo)}><Plus className="h-4 w-4" /></Button>
                      </div>
                      <div className="mb-3 rounded-xl border p-3" style={{ ...panelBorderStyle, background: mutedPanelBg }}>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-semibold">완료율 {completionRate}%</span>
                          <span>{completedTodos}/{dailyTodos.length} 완료 · {pendingTodos}개 남음</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full" style={{ background: panelTheme.rail }}>
                          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${completionRate}%` }} />
                        </div>
                        {completedTodos > 0 && (
                          <div className="mt-2 flex justify-end">
                            <Button variant="outline" size="sm" onClick={() => press(clearCompletedTodos)}>완료 항목 정리</Button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {dailyTodos.length === 0 ? <div className="text-sm opacity-70">{todoPanelLabels.empty}</div> : dailyTodos.map((item) => (
                          <div key={item.id} className={`flex items-center justify-between rounded-xl border p-2 ${item.done ? "bg-emerald-50/70" : item.important ? "bg-amber-50/70" : ""}`} style={item.done || item.important ? undefined : { ...panelBorderStyle, background: mutedPanelBg }}>
                            <div className={`min-w-0 flex-1 truncate text-sm ${item.done ? "text-slate-500 line-through" : ""}`}>{item.text}</div>
                            <div className="ml-2 flex items-center gap-1">
                              <Button variant={item.done ? "default" : "outline"} size="icon" onClick={() => press(() => toggleTodoDone(item.id))}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button variant={item.important ? "default" : "outline"} size="icon" disabled={item.done} onClick={() => press(() => toggleImportantTodo(item.id))}>
                                <Star className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="icon" onClick={() => press(() => removeTodo(item.id))}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-2xl border p-4 backdrop-blur-md" style={{ ...panelBorderStyle, background: softPanelBg }}>
                        <div className="mb-3 text-sm font-semibold">중요 할 일</div>
                        <div className="space-y-2">
                          {importantTodos.length === 0 ? <div className="text-sm opacity-70">중요 할 일이 없어</div> : importantTodos.map((item) => (
                            <div key={item.id} className="rounded-xl border border-amber-300 bg-amber-50/80 p-3 text-sm font-medium text-amber-900">★ {item.text}</div>
                          ))}
                        </div>
                      </div>

                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={`daily-message-${dailyMessageIndex}`}
                          initial={{ opacity: 0, y: isTouchViewport ? 10 : 18, scale: isTouchViewport ? 1 : 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: isTouchViewport ? -8 : -18, scale: isTouchViewport ? 1 : 0.98 }}
                          transition={{ duration: isTouchViewport ? 0.14 : 0.24, ease: motionEase }}
                          className="rounded-2xl border p-5 backdrop-blur-md"
                          style={{ ...panelBorderStyle, background: softPanelBg }}
                        >
                          <div className="mb-3 text-xs font-semibold tracking-[0.2em] opacity-70">오늘의 문구</div>
                          <div className="text-base font-semibold leading-relaxed md:text-lg">{activeDailyMessage.quote}</div>
                          <div className="mt-4 text-xs opacity-60">{activeDailyMessage.author}</div>
                        </motion.div>
                      </AnimatePresence>

                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <motion.div {...buttonMotionProps}><Button variant={mode === "table" ? "default" : "outline"} onClick={() => press(() => setMode("table"))}>표</Button></motion.div>
                    <motion.div {...buttonMotionProps}><Button variant={mode === "circle" ? "default" : "outline"} onClick={() => press(() => setMode("circle"))}>원형</Button></motion.div>
                    <select value={interval} onChange={(e) => setIntervalSize(Number(e.target.value))} className="rounded-xl border px-3 text-sm backdrop-blur-md" style={{ background: strongPanelBg, borderColor: panelTheme.border }}>
                      <option value={60}>60분</option>
                      <option value={30}>30분</option>
                      <option value={15}>15분</option>
                    </select>
                  </div>

                  <AnimatePresence mode="wait">
                    {mode === "table" ? (
                      <motion.div key="table" initial={{ opacity: 0, y: isTouchViewport ? 6 : 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: isTouchViewport ? -6 : -10 }} transition={{ duration: isTouchViewport ? 0.12 : 0.16, ease: motionEase }} className="max-h-[54dvh] overflow-auto rounded-2xl border p-2 backdrop-blur-md" style={{ ...panelBorderStyle, background: strongPanelBg }}>
                        <div className="space-y-2">{timeSlots.map((time) => (
                          <div key={time} className="flex flex-col gap-2 rounded-xl border p-2 backdrop-blur-sm sm:flex-row sm:items-center" style={{ ...panelBorderStyle, background: mutedPanelBg }}>
                            <div className="w-16 shrink-0 text-sm font-medium opacity-80">{time}</div>
                            <Input value={selectedPlans[time] || ""} onChange={(e) => updatePlan(time, e.target.value)} placeholder="계획 입력" />
                          </div>
                        ))}</div>
                      </motion.div>
                    ) : (
                      <motion.div key="circle" initial={{ opacity: 0, scale: isTouchViewport ? 0.995 : 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: isTouchViewport ? 0.998 : 0.96 }} transition={{ duration: isTouchViewport ? 0.12 : 0.16, ease: motionEase }} className="relative rounded-2xl border p-3 backdrop-blur-md sm:p-4" style={{ ...panelBorderStyle, background: strongPanelBg }}>
                        <div className="flex flex-col items-center gap-4">
                          <motion.div layout transition={isTouchViewport ? { duration: 0.14, ease: motionEase } : { type: "spring", stiffness: 240, damping: 24 }} className="relative max-w-full" style={{ width: `min(${circleSize}px, calc(100vw - 5.5rem))`, aspectRatio: "1 / 1" }}>
                            <svg width="100%" height="100%" viewBox={`0 0 ${circleSize} ${circleSize}`}>
                              <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(226,232,240,0.85)" strokeWidth="28" />
                              {circleSegments.map((segment, index) => {
                                const startAngle = (segment.start / 1440) * 360;
                                const endAngle = (segment.end / 1440) * 360;
                                return <path key={`${segment.label}-${index}`} d={describeArc(center, center, radius, startAngle, endAngle)} fill="none" stroke={segment.color} strokeWidth="28" strokeLinecap="round" />;
                              })}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                              <div className="text-sm opacity-70">하루 원형 플래너</div>
                              <div className="text-lg font-bold">{weekDays[selectedDate.getDay()]}요일</div>
                            </div>
                            <motion.div {...buttonMotionProps} className="absolute bottom-3 right-3">
                              <Button
                                variant="default"
                                size="icon"
                                aria-label={circleZoom ? "원형 플래너 줄이기" : "원형 플래너 키우기"}
                                className="h-12 w-12 rounded-full border border-slate-950 bg-slate-950 p-0 text-white shadow-[0_14px_30px_rgba(15,23,42,0.34)] backdrop-blur-md"
                                onClick={() => press(() => setCircleZoom((prev) => !prev))}
                              >
                                <PlannerZoomIcon zoomed={circleZoom} />
                              </Button>
                            </motion.div>
                          </motion.div>

                          <div className="grid w-full gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                            <div className="rounded-xl border p-3 text-sm backdrop-blur-md" style={{ ...panelBorderStyle, background: softPanelBg }}>
                              <div className="mb-1 flex items-center gap-2 font-semibold"><span className="h-3 w-3 rounded-full" style={{ background: SLEEP_COLOR }} /> 수면</div>
                              <div className="opacity-75">{sleep.enabled ? `${sleep.start} ~ ${sleep.end}` : "꺼짐"}</div>
                            </div>
                            {showSchedule && (
                              <div className="rounded-xl border p-3 text-sm backdrop-blur-md" style={{ ...panelBorderStyle, background: softPanelBg }}>
                                <div className="mb-1 flex items-center gap-2 font-semibold"><span className="h-3 w-3 rounded-full" style={{ background: SCHOOL_COLOR }} /> {scheduleLabel}</div>
                                <div className="opacity-75">{scheduleEnabled ? (scheduleBlocks.length > 0 ? `${scheduleBlocks[0].start} ~ ${scheduleBlocks[scheduleBlocks.length - 1].end}` : "설정 없음") : "꺼짐"}</div>
                              </div>
                            )}
                            <div className="rounded-xl border p-3 text-sm backdrop-blur-md sm:min-h-[200px]" style={{ ...panelBorderStyle, background: softPanelBg }}>
                              <div className="mb-1 flex items-center gap-2 font-semibold">
                                <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ background: morningMixBackground, boxShadow: `0 0 0 1px ${morningMixColor}22` }} />
                                오전 활동
                              </div>
                              <div className="space-y-1 text-xs opacity-85">
                                {morningEntries.length ? morningEntries.map((entry) => (
                                  <div key={entry.time} className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: entry.color }} />
                                    <span>{entry.time} {entry.value}</span>
                                  </div>
                                )) : <div className="opacity-70">없음</div>}
                              </div>
                            </div>
                            <div className="rounded-xl border p-3 text-sm backdrop-blur-md sm:min-h-[200px]" style={{ ...panelBorderStyle, background: softPanelBg }}>
                              <div className="mb-1 flex items-center gap-2 font-semibold">
                                <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ background: afternoonMixBackground, boxShadow: `0 0 0 1px ${afternoonMixColor}22` }} />
                                오후 활동
                              </div>
                              <div className="space-y-1 text-xs opacity-85">
                                {afternoonEntries.length ? afternoonEntries.map((entry) => (
                                  <div key={entry.time} className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: entry.color }} />
                                    <span>{entry.time} {entry.value}</span>
                                  </div>
                                )) : <div className="opacity-70">없음</div>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <input id="planner-media-upload" type="file" accept="image/*,video/*,.gif" className="sr-only" onChange={handleUpload} />

      <motion.div
        {...buttonMotionProps}
        className="fixed z-20 md:bottom-6 md:right-6"
        style={{ right: "max(env(safe-area-inset-right, 0px), 1rem)", bottom: "max(env(safe-area-inset-bottom, 0px), 1rem)" }}
      >
        <Button className="group h-14 rounded-full border border-white/70 bg-slate-950/88 px-4 text-white shadow-[0_20px_50px_rgba(2,6,23,0.5)] ring-2 ring-white/25 backdrop-blur-xl transition hover:bg-slate-900/95" onClick={() => press(() => setShowSettings((prev) => !prev))}>
          <Settings2 className="mr-2 h-5 w-5 transition group-hover:rotate-90" />
          <span className="text-sm font-semibold tracking-[0.2em]">설정</span>
        </Button>
      </motion.div>

      <AnimatePresence initial={false}>
        {savePulseVisible && (
          <motion.div
            key={`save-pulse-${savePulse}`}
            initial={{ opacity: 0, y: isTouchViewport ? 10 : 16, scale: isTouchViewport ? 1 : 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isTouchViewport ? -10 : -14, scale: isTouchViewport ? 1 : 0.98 }}
            transition={{ duration: isTouchViewport ? 0.16 : 0.22, ease: motionEase }}
            className="pointer-events-none fixed left-1/2 z-40 w-[min(84vw,320px)] -translate-x-1/2"
            style={{ top: isTouchViewport ? "7.75rem" : "5.75rem" }}
          >
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/92 p-4 text-emerald-900 shadow-[0_18px_40px_rgba(16,185,129,0.18)] backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <motion.span
                  initial={{ scale: isTouchViewport ? 0.92 : 0.7, opacity: 0.4 }}
                  animate={{ scale: isTouchViewport ? [0.96, 1.02, 1] : [0.9, 1.08, 1], opacity: 1 }}
                  transition={{ duration: isTouchViewport ? 0.24 : 0.45, ease: "easeOut" }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
                >
                  <Check className="h-4 w-4" />
                </motion.span>
                <div>
                  <div className="text-sm font-semibold">저장 완료</div>
                  <div className="text-xs opacity-80">{savePulseMessage}</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMonthPicker && view === "calendar" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-slate-950/30 px-3 py-6 backdrop-blur-[2px]"
            onClick={() => setShowMonthPicker(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: isTouchViewport ? 10 : 16, scale: isTouchViewport ? 1 : 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: isTouchViewport ? 8 : 14, scale: isTouchViewport ? 1 : 0.98 }}
              transition={{ duration: isTouchViewport ? 0.12 : 0.16, ease: motionEase }}
              className="mx-auto mt-16 w-full max-w-[420px] rounded-[26px] border p-4 shadow-2xl"
              style={{ background: strongPanelBg, borderColor: panelTheme.border }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-slate-900">직접 선택</div>
                  <div className="text-xs text-slate-500">원하는 연도와 월을 바로 골라서 이동할 수 있어.</div>
                </div>
                <motion.div {...buttonMotionProps}>
                  <Button variant="outline" size="icon" onClick={() => press(() => setShowMonthPicker(false))}>
                    <X className="h-4 w-4" />
                  </Button>
                </motion.div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border p-2" style={{ background: mutedPanelBg, borderColor: panelTheme.border }}>
                  <div className="mb-2 px-1 text-sm font-semibold text-slate-900">연도</div>
                  <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                    {yearOptions.map((optionYear) => (
                      <button
                        key={optionYear}
                        type="button"
                        onClick={() => {
                          triggerInteractionFeedback();
                          setPickerYear(optionYear);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${pickerYear === optionYear ? "bg-slate-900 text-white" : "bg-white/75 text-slate-900 hover:bg-white"}`}
                      >
                        <span>{optionYear}년</span>
                        {pickerYear === optionYear ? <span className="text-xs opacity-80">선택</span> : null}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border p-2" style={{ background: mutedPanelBg, borderColor: panelTheme.border }}>
                  <div className="mb-2 px-1 text-sm font-semibold text-slate-900">월</div>
                  <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                    {monthLabels.map((label, optionMonth) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          triggerInteractionFeedback();
                          setPickerMonth(optionMonth);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${pickerMonth === optionMonth ? "bg-slate-900 text-white" : "bg-white/75 text-slate-900 hover:bg-white"}`}
                      >
                        <span>{label}</span>
                        {pickerMonth === optionMonth ? <span className="text-xs opacity-80">선택</span> : null}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <motion.div {...buttonMotionProps} className="flex-1">
                  <Button variant="outline" className="w-full" onClick={() => jumpToYearMonth(today.getFullYear(), today.getMonth())}>
                    오늘로
                  </Button>
                </motion.div>
                <motion.div {...buttonMotionProps} className="flex-1">
                  <Button className="w-full" onClick={() => jumpToYearMonth(pickerYear, pickerMonth)}>
                    이동
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showSettings && (
          <motion.div
            initial={allowEntryMotion ? settingsPanelMotion.initial : false}
            animate={settingsPanelMotion.animate}
            exit={settingsPanelMotion.exit}
            transition={settingsPanelMotion.transition}
            className="fixed left-3 right-3 z-30 max-h-[min(84dvh,760px)] overflow-auto rounded-[24px] border p-4 shadow-2xl backdrop-blur-2xl sm:p-5 md:left-auto md:w-[min(94vw,480px)] md:rounded-[28px]"
            style={{ right: "max(env(safe-area-inset-right, 0px), 0.75rem)", bottom: "calc(max(env(safe-area-inset-bottom, 0px), 1rem) + 4rem)", background: strongPanelBg, borderColor: panelTheme.border }}
          >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-slate-900">캘린더 꾸미기</div>
                  <div className="text-sm text-slate-500">배경 업로드와 URL, 투명도, 비율을 한 번에 조절할 수 있어.</div>
                </div>
                <motion.div {...buttonMotionProps}><Button variant="outline" size="icon" onClick={() => press(() => setShowSettings(false))}><X className="h-4 w-4" /></Button></motion.div>
              </div>

              <div className="space-y-4 text-slate-900">
                <div className="space-y-3 rounded-xl border p-3" style={{ background: mutedPanelBg, borderColor: "rgba(148, 163, 184, 0.24)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">계정 동기화</div>
                      <div className="text-xs text-slate-500">
                        로그인하면 여러 기기에서 같은 일정과 설정을 이어서 쓸 수 있어. 로그인 전에는 이 기기에만 저장돼.
                      </div>
                    </div>
                    <div className={`rounded-full px-2 py-1 text-[11px] font-semibold ${sessionUser ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                      {sessionUser ? "로그인됨" : "로컬 전용"}
                    </div>
                  </div>

                  {!isSupabaseConfigured && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      `.env`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 넣으면 여기서 바로 로그인할 수 있어.
                    </div>
                  )}

                  {sessionUser ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border p-3 text-sm" style={{ background: "rgba(255,255,255,0.72)", borderColor: panelTheme.border }}>
                        <div className="mb-1 text-xs opacity-70">현재 계정</div>
                        <div className="font-medium break-all">{sessionUser.email || "이메일 없음"}</div>
                        <div className="mt-2 text-xs text-slate-500">
                          {cloudSyncing ? "계정 데이터와 동기화하는 중이야..." : authMessage || "계정 저장이 연결되어 있어."}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          로그인한 상태에서 올린 배경은 계정에도 저장돼서 다른 기기에서 같이 보여.
                        </div>
                      </div>
                      <Button variant="outline" className="w-full" disabled={authLoading} onClick={() => press(() => { void handleSignOut(); })}>
                        로그아웃
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant={authMode === "signin" ? "default" : "outline"}
                          className="w-full"
                          onClick={() => press(() => {
                            setAuthMode("signin");
                            setNeedsPasswordUpdate(false);
                            setAuthError("");
                            setAuthMessage("");
                          })}
                        >
                          로그인
                        </Button>
                        <Button
                          variant={authMode === "signup" ? "default" : "outline"}
                          className="w-full"
                          onClick={() => press(() => {
                            setAuthMode("signup");
                            setNeedsPasswordUpdate(false);
                            setAuthError("");
                            setAuthMessage("");
                          })}
                        >
                          회원가입
                        </Button>
                        <Button
                          variant={authMode === "reset" ? "default" : "outline"}
                          className="w-full"
                          onClick={() => press(() => {
                            setAuthMode("reset");
                            setNeedsPasswordUpdate(false);
                            setAuthError("");
                            setAuthMessage("");
                          })}
                        >
                          비밀번호 찾기
                        </Button>
                      </div>

                      {authMode !== "reset" || !needsPasswordUpdate ? (
                        <Input
                          type="email"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="이메일"
                          autoComplete="email"
                        />
                      ) : null}

                      {authMode !== "reset" || needsPasswordUpdate ? (
                        <Input
                          type="password"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder={authMode === "reset" ? "새 비밀번호" : "비밀번호"}
                          autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                        />
                      ) : null}

                      {(authMode === "signup" || (authMode === "reset" && needsPasswordUpdate)) && (
                        <Input
                          type="password"
                          value={authConfirmPassword}
                          onChange={(e) => setAuthConfirmPassword(e.target.value)}
                          placeholder={authMode === "reset" ? "새 비밀번호 확인" : "비밀번호 확인"}
                          autoComplete="new-password"
                        />
                      )}
                      <div className="rounded-xl border px-3 py-2 text-xs text-slate-500" style={{ background: "rgba(255,255,255,0.62)", borderColor: panelTheme.border }}>
                        {authMode === "signin"
                          ? "로그인하면 계획, 설정, 할 일, 업로드 배경까지 계정에 연결돼."
                          : authMode === "signup"
                            ? "회원가입 후 같은 계정으로 로그인하면 다른 기기에서도 그대로 이어서 쓸 수 있어."
                            : needsPasswordUpdate
                              ? "메일 링크로 돌아왔어. 여기서 새 비밀번호를 저장하면 바로 바뀌어."
                              : "가입한 이메일을 넣고 재설정 메일을 보내면, 메일 링크를 눌러 새 비밀번호를 정할 수 있어."}
                      </div>
                      {authError ? <div className="text-xs text-rose-600">{authError}</div> : null}
                      {authMessage ? <div className="text-xs text-emerald-700">{authMessage}</div> : null}
                      <Button disabled={authLoading || !isSupabaseConfigured} className="w-full" onClick={() => press(() => { void handleAuthSubmit(); })}>
                        {authLoading
                          ? "처리 중..."
                          : authMode === "signup"
                            ? "회원가입하고 저장 연결"
                            : authMode === "reset"
                              ? (needsPasswordUpdate ? "새 비밀번호 저장" : "재설정 메일 보내기")
                              : "로그인하고 동기화"}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2 rounded-xl border p-3" style={{ background: mutedPanelBg, borderColor: "rgba(148, 163, 184, 0.24)" }}>
                  <div className="text-sm font-semibold">생활 유형</div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant={profile === "student" ? "default" : "outline"} className="w-full" onClick={() => press(() => setProfile("student"))}>학생</Button>
                    <Button variant={profile === "worker" ? "default" : "outline"} className="w-full" onClick={() => press(() => setProfile("worker"))}>직장인</Button>
                    <Button variant={profile === "none" ? "default" : "outline"} className="w-full" onClick={() => press(() => setProfile("none"))}>해당없음</Button>
                  </div>
                  <div className="text-xs text-slate-500">
                    {profile === "student" ? "학교 시간은 월요일부터 금요일까지 한 구간으로 설정돼." : profile === "worker" ? "회사 시간은 평일 기준 한 구간으로 설정돼." : "학교나 회사 관련 창은 숨기고 순수 플래너만 보여줘."}
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border p-3" style={{ background: mutedPanelBg, borderColor: "rgba(148, 163, 184, 0.24)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">버튼 반응</div>
                      <div className="text-xs text-slate-500">짧은 애니메이션에 소리와 진동을 같이 맞춰서 눌리는 느낌을 더 살렸어.</div>
                    </div>
                    <div className="rounded-full bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
                      {Math.round(interaction.feedbackStrength * 100)}%
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={interaction.soundEnabled ? "default" : "outline"} className="w-full" onClick={() => press(toggleSoundFeedback)}>
                      소리 {interaction.soundEnabled ? "켜짐" : "꺼짐"}
                    </Button>
                    <Button variant={interaction.vibrationEnabled ? "default" : "outline"} className="w-full" onClick={() => press(toggleVibrationFeedback)}>
                      진동 {interaction.vibrationEnabled ? "켜짐" : "꺼짐"}
                    </Button>
                  </div>
                  <SettingsRangeField
                    label="피드백 강도"
                    min={0.2}
                    max={1}
                    step={0.05}
                    value={interaction.feedbackStrength}
                    onChange={updateFeedbackStrength}
                    onButtonPress={triggerInteractionFeedback}
                    hint="낮추면 더 조용하고 짧고, 올리면 소리와 진동이 조금 더 또렷해져."
                  />
                  <Button variant="outline" className="w-full" onClick={() => {
                    triggerInteractionFeedback();
                    triggerSavePulse("버튼 반응을 미리 느껴봤어", { force: true });
                  }}>
                    반응 미리보기
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">배경 업로드</label>
                  <motion.label
                    htmlFor="planner-media-upload"
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex w-full cursor-pointer items-center justify-start gap-2 rounded-md border px-3 py-2 text-sm font-medium text-slate-900 transition-transform duration-150 ease-out hover:scale-[0.985]"
                    style={{ background: strongPanelBg, borderColor: "rgba(148, 163, 184, 0.32)" }}
                  >
                    <Upload className="h-4 w-4" /> 사진 / GIF / 영상 업로드
                  </motion.label>
                  <div className="text-xs text-slate-500">{backgroundRatioHint}</div>
                  <div className="text-xs text-slate-500">
                    {sessionUser ? "배경 URL과 업로드한 이미지·영상은 계정에도 저장돼서 다른 기기에서도 이어서 보여." : "배경 URL과 업로드한 이미지·영상은 이 기기에 자동 저장돼. 로그인하면 다른 기기 동기화도 할 수 있어."}
                  </div>
                  {(decorMedia.uploadedMediaUrl || decorMedia.mediaUrl) && <div className="text-xs text-slate-500">배경이 적용되어 있어</div>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">배경 URL</label>
                  <Input value={decorMedia.mediaUrl} onChange={(e) => setDecorMedia((prev) => ({ ...prev, mediaUrl: e.target.value }))} placeholder="https://example.com/background.gif" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">배경 바탕색 (미디어 뒤)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={decorTheme.backgroundColor}
                      onChange={(e) => setDecorTheme((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                      className="h-10 w-14 rounded border"
                    />
                    <div className="text-sm text-slate-500">현재 색상: {decorTheme.backgroundColor}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">배경 비율 맞춤</label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={decorMedia.mediaFit === "auto" ? "default" : "outline"}
                      className="w-full"
                      onClick={() => press(() => setDecorMedia((prev) => ({ ...prev, mediaFit: "auto" })))}
                    >
                      자동
                    </Button>
                    <Button
                      variant={decorMedia.mediaFit === "cover" ? "default" : "outline"}
                      className="w-full"
                      onClick={() => press(() => setDecorMedia((prev) => ({ ...prev, mediaFit: "cover" })))}
                    >
                      꽉 채움
                    </Button>
                    <Button
                      variant={decorMedia.mediaFit === "contain" ? "default" : "outline"}
                      className="w-full"
                      onClick={() => press(() => setDecorMedia((prev) => ({ ...prev, mediaFit: "contain" })))}
                    >
                      전체 보기
                    </Button>
                  </div>
                  <div className="text-xs text-slate-500">
                    {decorMedia.mediaFit === "auto" ? `자동 적용: ${resolvedMediaFit === "cover" ? "꽉 채움" : "전체 보기"}` : `수동 적용: ${decorMedia.mediaFit === "cover" ? "꽉 채움" : "전체 보기"}`}
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  배경을 분석해서 글자색을 자동으로 맞춰.
                </div>

                <SettingsRangeField
                  label="배경 어둡기"
                  min={0}
                  max={0.7}
                  step={0.02}
                  value={decorTheme.overlayOpacity}
                  onChange={(value) => setDecorTheme((prev) => ({ ...prev, overlayOpacity: value }))}
                  onButtonPress={triggerInteractionFeedback}
                />

                <SettingsRangeField
                  label="캘린더 패널 투명도"
                  min={0}
                  max={1}
                  step={0.02}
                  value={decorTheme.panelOpacity}
                  onChange={(value) => setDecorTheme((prev) => ({ ...prev, panelOpacity: value }))}
                  onButtonPress={triggerInteractionFeedback}
                  hint="최저값에서는 날짜 칸을 제외한 영역이 거의 투명하게 보이고, 버튼으로도 세밀하게 올리고 내릴 수 있어."
                />

                <div className="space-y-2 rounded-xl border p-3" style={{ background: mutedPanelBg, borderColor: "rgba(148, 163, 184, 0.24)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">요일별 계획 동기화</div>
                      <div className="text-xs text-slate-500">같은 요일끼리 같은 계획표를 공유해.</div>
                    </div>
                    <Button variant={planSync.byWeekday ? "default" : "outline"} onClick={() => press(toggleWeekdaySync)}>
                      {planSync.byWeekday ? "켜짐" : "꺼짐"}
                    </Button>
                  </div>
                  <div className="text-xs text-slate-500">
                    {planSync.byWeekday
                      ? `현재 ${weekDays[weekday]}요일 계획이 모든 ${weekDays[weekday]}요일에 적용돼.`
                      : "현재는 날짜별로 각각 다른 계획을 사용 중이야."}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <motion.div whileTap={{ scale: 0.95 }}>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => press(() => setDecorTheme((prev) => ({ ...prev, overlayOpacity: 0.08, panelOpacity: 0.54 })))}
                    >
                      배경 강조
                    </Button>
                  </motion.div>
                  <motion.div whileTap={{ scale: 0.95 }}>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => press(() => setDecorTheme((prev) => ({ ...prev, overlayOpacity: 0.28, panelOpacity: 0.78 })))}
                    >
                      가독성 우선
                    </Button>
                  </motion.div>
                </div>

                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button variant="outline" className="w-full" onClick={() => press(() => { void clearBackgroundMedia(); })}>
                    배경 삭제
                  </Button>
                </motion.div>

                <div className="flex gap-2 pt-2">
                  <motion.div whileTap={{ scale: 0.95 }} className="flex-1"><Button className="w-full" onClick={() => press(resetDecorSettings)}>기본값으로</Button></motion.div>
                  <motion.div whileTap={{ scale: 0.95 }} className="flex-1"><Button variant="outline" className="w-full" onClick={() => press(() => setShowSettings(false))}>닫기</Button></motion.div>
                </div>
              </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
