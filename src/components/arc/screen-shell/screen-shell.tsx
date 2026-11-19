"use client";

import { createContext, isValidElement, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ButtonHTMLAttributes, ComponentType, CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { Check, ChevronDown, ChevronRight, ChevronsUpDown, Hash, Menu, PanelLeft, PanelRight, Plus, Search, X } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import { Avatar as ArcAvatar } from "../avatar/avatar";
import { Kbd } from "../kbd/kbd";
import styles from "./screen-shell.module.css";

/* ------------------------------------------------------------------------------------------------
 * Types
 * ---------------------------------------------------------------------------------------------- */

/** Any lucide icon, or your own component that takes the same size and stroke props. */
export type ScreenShellIcon = ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>;

/** Arc's categorical tones (--tone-*), for workspace marks and section dots. */
export type ScreenShellTone = "teal" | "sky" | "orchid" | "violet" | "rose" | "amber" | "green";

export interface ScreenShellMenuItem {
  id: string;
  label: string;
  icon?: ScreenShellIcon;
  /** A hint shown on the right, such as "⌘," */
  shortcut?: string;
  /** Destructive items such as "Sign out" or "Leave workspace" use the danger colour. */
  danger?: boolean;
  /** Draws a check on the right, for toggles inside a menu. */
  checked?: boolean;
  /** Draws a hairline above this item. */
  separatorBefore?: boolean;
  onSelect?: () => void;
}

export interface ScreenShellWorkspaceOption {
  id: string;
  name: string;
  /** A second line in the switcher menu, such as "Pro plan · 12 members". */
  detail?: string;
  /** Your own logo. Leave it out for a seeded mark drawn from the name. */
  mark?: ReactNode;
  tone?: ScreenShellTone;
}

export interface ScreenShellWorkspace {
  /** Shown when there are no options, and as the fallback name. */
  name: string;
  detail?: string;
  mark?: ReactNode;
  tone?: ScreenShellTone;
  /** Workspaces to switch between. The shell keeps the current one and calls onSelect. */
  options?: ScreenShellWorkspaceOption[];
  /** The current option. Leave it out to start on the first option and let the shell keep the choice. */
  activeId?: string;
  onSelect?: (id: string) => void;
  /** Items below the workspace list, such as "Workspace settings" or "Invite people". */
  actions?: ScreenShellMenuItem[];
}

export interface ScreenShellNavItem {
  id: string;
  label: string;
  icon?: ScreenShellIcon;
  /** A count on the right, such as unread messages. Tabular numerals. */
  count?: number | string;
  /** A small accent dot on the right instead of a count. */
  dot?: boolean;
}

export interface ScreenShellSectionItem {
  id: string;
  label: string;
  /** Tints the item's icon in one of Arc's categorical tones. Without an icon a quiet # glyph takes the tint; no coloured dots. */
  tone?: ScreenShellTone;
  /** Any CSS colour for the icon, when a tone does not fit. */
  color?: string;
  /** An image URL drawn as a 16px avatar, for people and direct messages. */
  avatar?: string;
  /** A lucide icon, tinted by tone or color when given. Without icon or avatar a quiet # glyph is drawn. */
  icon?: ScreenShellIcon;
  count?: number | string;
  /** An accent dot on the right: something new inside. */
  unread?: boolean;
}

export interface ScreenShellSection {
  id: string;
  /** A short sentence case heading, such as "Projects", "Pinned" or "Channels". */
  label: string;
  items: ScreenShellSectionItem[];
  /** The heading folds the section. Default true. */
  collapsible?: boolean;
  /** Default true. */
  defaultOpen?: boolean;
  /** A small icon button on the heading, such as "New project". */
  action?: { label: string; icon?: ScreenShellIcon; onSelect: () => void };
  /** An icon before the heading. It stays on the icon axis in the collapsed rail, where pressing it expands the sidebar. */
  icon?: ScreenShellIcon;
  /**
   * App specific content shown instead of the item list: a mini month calendar, a folder tree, a watchlist with prices,
   * a repo list or saved views. It keeps the full sidebar width (232px) and is hidden in the rail. Pass `items: []` with it.
   */
  content?: ReactNode;
}

export interface ScreenShellAccount {
  name: string;
  /** A second line, such as an email address or role. */
  detail?: string;
  /** An image URL. Leave it out for initials. */
  avatar?: string;
  /** Items in the account menu, such as Profile, Settings and Sign out. Without items the row is plain content. */
  menu?: ScreenShellMenuItem[];
}

export interface ScreenShellCrumb {
  id: string;
  label: string;
  /** Makes the crumb a button. */
  onSelect?: () => void;
}

export interface ScreenShellHeader {
  /** The current page. The last thing in the trail. */
  title: ReactNode;
  breadcrumbs?: ScreenShellCrumb[];
  /** Quiet text after the title, such as "12 issues". */
  meta?: ReactNode;
  /** Right aligned controls. ScreenShellButton fits the header height. */
  actions?: ReactNode;
  /** A row under the bar, for tabs or filters. */
  below?: ReactNode;
}

export interface ScreenShellPanel {
  content: ReactNode;
  /** Accessible name of the panel. Default "Details". */
  label?: string;
  /** Starting width in px. Default 320. */
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  /** Drag its left edge (or use the arrow keys on it) to resize. Default true. */
  resizable?: boolean;
  /** Controlled open state. Leave it out and the header's panel button toggles it. */
  open?: boolean;
  /** Default true on wide frames. Below 1080px the panel is a sheet and starts closed. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Shows the panel button in the header. Default true. */
  toggle?: boolean;
}

export interface ScreenShellCards {
  /** A dismissible note above the account row. */
  whatsNew?: { title: string; body?: string; action?: { label: string; onSelect: () => void }; onDismiss?: () => void };
  /** A setup or quota card with a bar. `value` out of `total` (default 100). */
  progress?: { title: string; value: number; total?: number; detail?: string; onSelect?: () => void };
}

export interface ScreenShellSearch {
  /** Default "Search". */
  placeholder?: string;
  /** Default "⌘K". */
  shortcut?: string;
  /** Opens your own command palette instead of filtering the sidebar in place. */
  onOpen?: () => void;
  /** Listens for ⌘K and Ctrl+K on the window. Default true. */
  hotkey?: boolean;
}

export type ScreenShellVariant = "inset" | "flat";
export type ScreenShellSize = "full" | "compact" | "phone";

export interface ScreenShellProps {
  workspace: ScreenShellWorkspace;
  nav: ScreenShellNavItem[];
  sections?: ScreenShellSection[];
  /** The selected nav or section item. Leave it out and pass defaultActiveId to let the shell keep it. */
  activeId?: string;
  defaultActiveId?: string;
  onNavigate?: (id: string, item: ScreenShellNavItem | ScreenShellSectionItem) => void;
  account?: ScreenShellAccount;
  /** A bar at the top of the main area: a config object, or your own node (add ScreenShellMenuButton to it). */
  header?: ScreenShellHeader | ReactNode;
  /** A panel on the right: a config object, or a node for a plain resizable panel. */
  rightPanel?: ScreenShellPanel | ReactNode;
  /** "inset": the main area is a raised rounded surface on a muted canvas. "flat": edge to edge with hairlines. Default "inset". */
  variant?: ScreenShellVariant;
  /** Optional cards above the account row. Nothing is shown unless you pass them. */
  cards?: ScreenShellCards;
  /** Your own content under the search field, such as a "New issue" button or a filter. Folds away in the rail. */
  sidebarTop?: ReactNode;
  /** Your own content above the cards and the account row, such as a storage meter or a status line. Folds away in the rail. */
  sidebarFooter?: ReactNode;
  /** Set false to hide search. */
  search?: ScreenShellSearch | false;
  /** Controlled rail state. */
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** The main area scrolls with hidden scrollbars and edge fades. Set false when the page owns its scrolling (a board, a split view). Default true. */
  scroll?: boolean;
  /** Content padding inside the main area. "none" for full bleed pages. Default "default". */
  padding?: "default" | "none";
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Accessible name for the sidebar navigation. Default "Workspace". */
  "aria-label"?: string;
}

export interface ScreenShellContextValue {
  size: ScreenShellSize;
  /** True below 900px, where the sidebar is a sheet. */
  compact: boolean;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  activeId: string | undefined;
  navigate: (id: string) => void;
}

/* ------------------------------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------------------------------- */

const SIDEBAR_WIDTH = 248;
const RAIL_WIDTH = 56;
const COMPACT_BELOW = 900;
const PHONE_BELOW = 600;
const PANEL_DOCKED_FROM = 1080;

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const instant: Transition = { duration: 0 };



function isPanelConfig(value: unknown): value is ScreenShellPanel {
  return typeof value === "object" && value !== null && !isValidElement(value) && "content" in value;
}

function isHeaderConfig(value: unknown): value is ScreenShellHeader {
  return typeof value === "object" && value !== null && !isValidElement(value) && "title" in value;
}

/** Marks a scroller's cut edges with data-fade-top and data-fade-bottom, without re-rendering. */
function useEdgeFade<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    const update = () => {
      element.toggleAttribute("data-fade-top", element.scrollTop > 1);
      element.toggleAttribute("data-fade-bottom", element.scrollTop + element.clientHeight < element.scrollHeight - 1);
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    const mutations = new MutationObserver(update);
    mutations.observe(element, { childList: true, subtree: true });
    return () => { element.removeEventListener("scroll", update); observer.disconnect(); mutations.disconnect(); };
  }, [enabled]);
  return ref;
}

/** A value that is controlled when `value` is defined and kept locally otherwise. */
function useControllable<T>(value: T | undefined, initial: T, onChange?: (next: T) => void) {
  const [local, setLocal] = useState(initial);
  const current = value === undefined ? local : value;
  const set = useCallback((next: T) => { if (value === undefined) setLocal(next); onChange?.(next); }, [value, onChange]);
  return [current, set] as const;
}

const ShellContext = createContext<ScreenShellContextValue | null>(null);

/** Read the shell from a page inside it: open the sheet from your own header, toggle the panel, read the size. */
export function useScreenShell(): ScreenShellContextValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error("useScreenShell must be used inside <ScreenShell>.");
  return value;
}

/* ------------------------------------------------------------------------------------------------
 * Small exported parts
 * ---------------------------------------------------------------------------------------------- */

/**
 * Workspace logos drawn for Arc: twelve original marks built like real brand identities, never letters, stars or swirls.
 * Every mark is one white shape on a 24px grid inside 4 to 20, with 4 unit bars and 2 unit gaps, so the set shares one weight.
 * A workspace without its own logo gets a mark and a solid brand tile picked from its name, so it always looks the same.
 */
const logoMarks = [
  // Wedge: a disc with its top quarter lifted out along the diagonal.
  { id: "wedge", d: "M11.3 12.7H18.8A7.5 7.5 0 1 1 11.3 5.2ZM12.7 11.3V3.8A7.5 7.5 0 0 1 20.2 11.3Z" },
  // Split: a disc cut in two and slid apart, one half up and one down.
  { id: "split", d: "M11 3.6A7.4 7.4 0 0 0 11 18.4ZM13 5.6A7.4 7.4 0 0 1 13 20.4Z" },
  // Terrace: three equal bars leaning forward, a block in motion.
  { id: "terrace", d: "M11.5 4H20.5L18.5 8H9.5ZM8.5 10H17.5L15.5 14H6.5ZM5.5 16H14.5L12.5 20H3.5Z" },
  // Bridge: a solid span over a round arch, the gate of a city.
  { id: "bridge", d: "M4 5H20V19H16V15A4 4 0 0 0 8 15V19H4Z" },
  // Frame: two corners holding a square of empty space.
  { id: "frame", d: "M4 4H15V8H8V15H4ZM20 20H9V16H16V9H20Z" },
  // Seed: a leaf split along its spine into two halves.
  { id: "seed", d: "M4 18.6V12A8 8 0 0 1 12 4H18.6ZM5.4 20H12A8 8 0 0 0 20 12V5.4Z" },
  // Pocket: a square with a round bite that holds a ball.
  { id: "pocket", d: "M4 4H11A9 9 0 0 0 20 13V20H4ZM14 7A3 3 0 1 0 20 7A3 3 0 1 0 14 7Z" },
  // Modules: three square blocks and one round one, a system of parts.
  { id: "modules", d: "M4 4H11V11H4ZM13 4H20V11H13ZM4 13H11V20H4ZM12.9 16.5A3.6 3.6 0 1 0 20.1 16.5A3.6 3.6 0 1 0 12.9 16.5Z" },
  // Lens: a solid disc with an off-centre aperture.
  { id: "lens", d: "M3.6 12A8.4 8.4 0 1 0 20.4 12A8.4 8.4 0 1 0 3.6 12ZM10.6 9.8A3.6 3.6 0 1 1 17.8 9.8A3.6 3.6 0 1 1 10.6 9.8Z" },
  // Steps: a solid stair rising in three equal treads.
  { id: "steps", d: "M4 20V14.67H9.33V9.33H14.67V4H20V20Z" },
  // Drop: a disc drawn to one sharp corner, a single confident form.
  { id: "drop", d: "M11.6 3.6H20.4V12.4A8.4 8.4 0 1 1 11.6 3.6Z" },
  // Cube: three faces of a block, split by even gaps.
  { id: "cube", d: "M12 11.05L5.03 7.02L12 3L18.97 7.02ZM11 12.78V20.82L4.03 16.8V8.75ZM13 12.78L19.97 8.75V16.8L13 20.82Z" },
] as const;

/** The names of the twelve marks, for picking one explicitly with `variant`. */
export type ScreenShellLogoVariant = (typeof logoMarks)[number]["id"];
/** The tile colours a seeded mark picks from: the seven tones plus ink, a near-black tile. */
const logoFills: (ScreenShellTone | "ink")[] = ["violet", "teal", "ink", "sky", "rose", "green", "orchid", "amber"];

/** FNV-1a over the name with a murmur finaliser, so names sharing a prefix (lumen-web, lumen-api) still land far apart. */
function seedHash(name: string) {
  let hash = 2166136261;
  for (const char of name.trim().toLowerCase()) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x85ebca6b); hash ^= hash >>> 13; hash = Math.imul(hash, 0xc2b2ae35); hash ^= hash >>> 16;
  return hash >>> 0;
}

export interface ScreenShellMarkProps {
  /** Seeds the mark and the tile colour. */
  name: string;
  /** The tile colour. Leave it out to pick one from the name. */
  tone?: ScreenShellTone;
  /** A mark by name ("wedge", "bridge", ...) or index (0 to 11). Leave it out to pick one from the name. */
  variant?: number | ScreenShellLogoVariant;
  /** Square size in px. */
  size?: number;
  className?: string;
}

/** The workspace logo: a white mark on a solid brand tile, picked from the name. `variant` and `tone` choose them explicitly. */
export function ScreenShellMark({ name, tone, variant, size = 22, className }: ScreenShellMarkProps) {
  const hash = seedHash(name);
  const index = typeof variant === "string" ? Math.max(0, logoMarks.findIndex(mark => mark.id === variant))
    : variant === undefined ? hash % logoMarks.length : Math.abs(Math.round(variant)) % logoMarks.length;
  const fill = tone ?? logoFills[Math.floor(hash / logoMarks.length) % logoFills.length];
  return <span className={cx(styles.mark, className)} data-tone={fill} style={{ width: size, height: size } as CSSProperties} aria-hidden="true">
    <svg viewBox="0 0 24 24" focusable="false"><path d={logoMarks[index].d} fill="currentColor" fillRule="evenodd" /></svg>
  </span>;
}

/** The same logo under a brand-facing name, for screens that draw a workspace or company logo with an explicit `variant`. */
export const ScreenShellLogo = ScreenShellMark;

/** Arc's Avatar at its small size (28px), hidden from assistive technology because the name is always written beside it. */
function Avatar({ name, src }: { name: string; src?: string }) {
  return <ArcAvatar name={name} src={src} size="sm" className={styles.avatar} aria-hidden="true" />;
}

type ShellButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"> & {
  variant?: "primary" | "secondary" | "ghost";
  icon?: ScreenShellIcon;
  /** Hides the label visually; pass aria-label. */
  iconOnly?: boolean;
};

/** A header sized button with Arc's Button tokens and press: 32px tall, squeezes to 0.97, instant hover fill. */
export function ScreenShellButton({ variant = "secondary", icon: Icon, iconOnly, className, children, type = "button", ...rest }: ShellButtonProps) {
  const reduce = useReducedMotion();
  // A button that opens a menu or popover anchors it, so it answers the press with colour only, as Arc's Button does.
  const anchor = rest["aria-haspopup"] !== undefined && rest["aria-haspopup"] !== false && rest["aria-haspopup"] !== "false";
  return <motion.button type={type} className={cx(styles.button, iconOnly && styles.buttonIcon, className)} data-variant={variant} whileTap={reduce || anchor || rest.disabled ? undefined : { scale: .97 }} transition={motionTokens.spring.snappy} {...rest}>
    {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden="true" />}
    {!iconOnly && children}
  </motion.button>;
}

/** Opens the sidebar sheet below 900px. Rendered by the built-in header; add it to a custom header. Hidden on wide frames. */
export function ScreenShellMenuButton({ className }: { className?: string }) {
  const shell = useContext(ShellContext);
  if (!shell) return null;
  return <button type="button" className={cx(styles.iconButton, styles.menuButton, className)} aria-label="Open navigation" data-ss-menu-button="" onClick={shell.openSidebar}><Menu size={16} strokeWidth={1.75} aria-hidden="true" /></button>;
}

/* ------------------------------------------------------------------------------------------------
 * Menu: one floating list for the workspace switcher and the account, positioned inside the shell
 * so the sidebar can clip during its width morph without clipping the menu.
 * ---------------------------------------------------------------------------------------------- */

type MenuState = { kind: "workspace" | "account"; top: number; left: number; bottom?: number; width: number } | null;

function MenuList({ state, label, onClose, children }: { state: NonNullable<MenuState>; label: string; onClose: (restoreFocus: boolean) => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const up = state.bottom !== undefined;
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[role^=menuitem]")?.focus({ preventScroll: true });
  }, []);
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") { event.preventDefault(); onClose(true); return; }
    if (event.key === "Tab") { onClose(false); return; }
    const next = event.key === "ArrowDown" ? items[(index + 1) % items.length]
      : event.key === "ArrowUp" ? items[(index - 1 + items.length) % items.length]
      : event.key === "Home" ? items[0] : event.key === "End" ? items.at(-1) : undefined;
    if (next) { event.preventDefault(); next.focus({ preventScroll: true }); }
  };
  return <motion.div ref={ref} role="menu" aria-label={label} className={styles.menu} onKeyDown={onKeyDown}
    style={{ left: state.left, width: state.width, ...(up ? { bottom: state.bottom } : { top: state.top }), transformOrigin: up ? "50% 100%" : "50% 0%" }}
    initial={reduce ? { opacity: 0 } : { opacity: 0, y: up ? 5 : -5, scale: .97 }}
    animate={{ opacity: 1, y: 0, scale: 1, transition: reduce ? instant : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.enter] } } }}
    exit={{ opacity: 0, y: reduce ? 0 : up ? 2 : -2, scale: reduce ? 1 : .985, transition: reduce ? instant : { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] } }}>
    {children}
  </motion.div>;
}

function MenuItems({ items, onDone }: { items: ScreenShellMenuItem[]; onDone: () => void }) {
  return <>{items.map(item => {
    const Icon = item.icon;
    return <div key={item.id} className={styles.menuGroup} data-separated={item.separatorBefore ? "" : undefined}>
      <button type="button" role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"} aria-checked={item.checked} className={styles.menuItem} data-danger={item.danger ? "" : undefined} onClick={() => { onDone(); item.onSelect?.(); }}>
        {Icon && <Icon size={16} strokeWidth={1.75} className={styles.menuIcon} aria-hidden="true" />}
        <span className={styles.menuLabel}>{item.label}</span>
        {item.shortcut && <kbd className={styles.menuShortcut}>{item.shortcut}</kbd>}
        {item.checked && <Check size={14} strokeWidth={2} className={styles.menuCheck} aria-hidden="true" />}
      </button>
    </div>;
  })}</>;
}

/* ------------------------------------------------------------------------------------------------
 * ScreenShell
 * ---------------------------------------------------------------------------------------------- */

type AnyItem = ScreenShellNavItem | ScreenShellSectionItem;

/**
 * The app frame every Arc screen is built on: a collapsible sidebar (workspace switcher, search, navigation, sections,
 * cards and the account), a main area with an optional header bar and a scroll container, and an optional resizable
 * right panel. It fills its container's height, so give the parent a height (the screen frame is 1440 by 900).
 */
function ScreenShellBase({
  workspace, nav, sections, activeId: activeProp, defaultActiveId, onNavigate, account, header, rightPanel, variant = "inset", cards, sidebarTop, sidebarFooter,
  search = {}, collapsed: collapsedProp, defaultCollapsed = false, onCollapsedChange, scroll = true, padding = "default", children, className, style,
  "aria-label": ariaLabel = "Workspace",
}: ScreenShellProps) {
  const uid = useId();
  const reduce = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuButtonReturn = useRef<HTMLElement | null>(null);
  const menuTriggerRef = useRef<HTMLElement | null>(null);

  /* Size: measured from the shell itself, so it adapts inside an iframe, a card or a resizable pane alike. The CSS
   * container queries use the same thresholds and own the layout; this drives behaviour (inert, focus, panel mode). */
  const [width, setWidth] = useState(1440);
  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const size: ScreenShellSize = width < PHONE_BELOW ? "phone" : width < COMPACT_BELOW ? "compact" : "full";
  const compact = size !== "full";
  const docked = width >= PANEL_DOCKED_FROM;

  const [collapsedValue, setCollapsed] = useControllable(collapsedProp, defaultCollapsed, onCollapsedChange);
  const collapsed = !compact && collapsedValue;
  const [activeId, setActive] = useControllable<string | undefined>(activeProp, defaultActiveId ?? nav[0]?.id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<MenuState>(null);
  const [tip, setTip] = useState<{ label: string; top: number; shortcut?: string } | null>(null);

  /* Workspace switching */
  const options = workspace.options ?? [];
  const [workspaceId, setWorkspaceId] = useControllable<string | undefined>(workspace.activeId, options[0]?.id);
  const currentWorkspace = options.find(option => option.id === workspaceId) ?? { id: "", name: workspace.name, detail: workspace.detail, mark: workspace.mark, tone: workspace.tone };

  /* Right panel */
  const panel: ScreenShellPanel | null = useMemo(() => rightPanel == null || rightPanel === false ? null : isPanelConfig(rightPanel) ? rightPanel : { content: rightPanel }, [rightPanel]);
  const [panelOpenDocked, setPanelOpenDocked] = useState(panel?.defaultOpen ?? true);
  const [panelOpenSheet, setPanelOpenSheet] = useState(false);
  const panelOpen = panel?.open ?? (docked ? panelOpenDocked : panelOpenSheet);
  const setPanelOpen = useCallback((open: boolean) => {
    if (panel?.open === undefined) (docked ? setPanelOpenDocked : setPanelOpenSheet)(open);
    panel?.onOpenChange?.(open);
  }, [panel, docked]);
  const minPanel = panel?.minWidth ?? 260;
  const maxPanel = panel?.maxWidth ?? 520;
  const [panelWidth, setPanelWidth] = useState(() => Math.min(maxPanel, Math.max(minPanel, panel?.defaultWidth ?? 320)));
  const [resizing, setResizing] = useState(false);
  const panelSheetOpen = Boolean(panel) && !docked && panelOpen;

  /* The sheet closes when the frame grows past the compact width. Adjusting state during render, not in an effect. */
  const [wasCompact, setWasCompact] = useState(compact);
  if (wasCompact !== compact) { setWasCompact(compact); if (!compact) setSheetOpen(false); }

  const openSidebar = useCallback(() => {
    menuButtonReturn.current = document.activeElement as HTMLElement | null;
    setSheetOpen(true);
  }, []);
  const closeSidebar = useCallback(() => {
    setSheetOpen(false);
    const target = menuButtonReturn.current;
    if (target?.isConnected) requestAnimationFrame(() => target.focus({ preventScroll: true }));
  }, []);

  const allItems = useMemo(() => [...nav, ...(sections ?? []).flatMap(section => section.items)], [nav, sections]);
  // The second argument (via keyboard) is kept for callers; the active fill no longer moves, so it changes nothing.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigate = useCallback((id: string, viaKeyboard = false) => {
    const item = allItems.find(entry => entry.id === id);
    if (!item) return;
    setActive(id);
    onNavigate?.(id, item);
    if (compact) closeSidebar();
  }, [allItems, setActive, onNavigate, compact, closeSidebar]);

  const focusSearch = useCallback(() => {
    if (search && search.onOpen) { search.onOpen(); return; }
    // Focus right away when the field is on screen, so the first typed letter lands in it; otherwise once it has rendered.
    if (!compact && !collapsed && searchRef.current) { searchRef.current.focus({ preventScroll: true }); return; }
    if (compact) { menuButtonReturn.current = document.activeElement as HTMLElement | null; setSheetOpen(true); }
    else if (collapsed) setCollapsed(false);
    requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
  }, [search, compact, collapsed, setCollapsed]);

  /* ⌘K and Ctrl+K */
  const hotkey = search !== false && search.hotkey !== false;
  useEffect(() => {
    if (!hotkey) return;
    const onKey = (event: KeyboardEvent) => {
      // Capture phase, so a page level palette listening for the same keys does not open on top of the shell's search.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); event.stopPropagation(); focusSearch(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [hotkey, focusSearch]);

  /* The sheet: Escape closes it and focus moves inside when it opens. */
  useEffect(() => {
    if (!sheetOpen) return;
    const frame = requestAnimationFrame(() => sidebarRef.current?.querySelector<HTMLElement>("[data-ss-item][aria-current], [data-ss-item]")?.focus({ preventScroll: true }));
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !menu) closeSidebar(); };
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", onKey); };
  }, [sheetOpen, closeSidebar, menu]);

  useEffect(() => {
    if (!panelSheetOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !menu) setPanelOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelSheetOpen, setPanelOpen, menu]);

  /* Menus: positioned against the shell, closed by an outside press. */
  const openMenu = (kind: "workspace" | "account", trigger: HTMLElement) => {
    if (menu?.kind === kind) { setMenu(null); return; }
    const root = rootRef.current;
    if (!root) return;
    const box = root.getBoundingClientRect();
    const rect = trigger.getBoundingClientRect();
    menuTriggerRef.current = trigger;
    const menuWidth = Math.max(232, Math.min(rect.width, 280));
    const narrowTrigger = rect.width < 120;
    const left = narrowTrigger ? rect.right - box.left + 8 : rect.left - box.left;
    if (kind === "account") setMenu({ kind, left, top: 0, bottom: narrowTrigger ? box.bottom - rect.bottom : box.bottom - rect.top + 6, width: menuWidth });
    else setMenu({ kind, left, top: narrowTrigger ? rect.top - box.top : rect.bottom - box.top + 6, width: menuWidth });
  };
  const closeMenu = useCallback((restoreFocus: boolean) => {
    setMenu(null);
    if (restoreFocus) menuTriggerRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (!menu) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.querySelector("[role=menu]")?.contains(target) || menuTriggerRef.current?.contains(target)) return;
      setMenu(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menu]);

  /* Rail tooltips, drawn at shell level so the clipped sidebar never cuts them. */
  const showTip = (label: string, element: HTMLElement, shortcut?: string) => {
    if (!collapsed) return;
    const root = rootRef.current;
    if (!root) return;
    const rect = element.getBoundingClientRect();
    setTip({ label, top: rect.top - root.getBoundingClientRect().top + rect.height / 2, shortcut });
  };
  const hideTip = () => setTip(null);
  const [prevCollapsed, setPrevCollapsed] = useState(collapsed);
  if (prevCollapsed !== collapsed) { setPrevCollapsed(collapsed); setTip(null); }

  /* Roving arrows between sidebar items. */
  const onSidebarKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const target = event.target as HTMLElement;
    if (!target.matches("[data-ss-item]")) return;
    const items = [...(sidebarRef.current?.querySelectorAll<HTMLElement>("[data-ss-item]") ?? [])].filter(item => item.getClientRects().length && !item.closest("[inert]"));
    const index = items.indexOf(target);
    const next = event.key === "Home" ? items[0] : event.key === "End" ? items.at(-1) : items[index + (event.key === "ArrowDown" ? 1 : -1)];
    if (!next) return;
    event.preventDefault();
    next.focus({ preventScroll: true });
    next.scrollIntoView({ block: "nearest" });
  };

  /* Panel resize */
  const dragStart = useRef<{ x: number; width: number } | null>(null);
  const onHandleDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: event.clientX, width: panelWidth };
    setResizing(true);
  };
  const onHandleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    setPanelWidth(Math.min(maxPanel, Math.max(minPanel, dragStart.current.width + dragStart.current.x - event.clientX)));
  };
  const onHandleUp = () => { dragStart.current = null; setResizing(false); };
  const onHandleKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 48 : 16;
    const next = event.key === "ArrowLeft" ? panelWidth + step : event.key === "ArrowRight" ? panelWidth - step : event.key === "Home" ? maxPanel : event.key === "End" ? minPanel : null;
    if (next === null) return;
    event.preventDefault();
    setPanelWidth(Math.min(maxPanel, Math.max(minPanel, next)));
  };

  const context = useMemo<ScreenShellContextValue>(() => ({
    size, compact, collapsed, setCollapsed, openSidebar, closeSidebar, panelOpen, setPanelOpen, activeId, navigate: (id: string) => navigate(id),
  }), [size, compact, collapsed, setCollapsed, openSidebar, closeSidebar, panelOpen, setPanelOpen, activeId, navigate]);

  const morph = reduce ? instant : motionTokens.spring.morph;
  const sidebarHidden = compact && !sheetOpen;
  const searchConfig = search === false ? null : search;
  const trimmed = query.trim().toLowerCase();
  const results = trimmed ? allItems.filter(item => item.label.toLowerCase().includes(trimmed)) : null;

  const renderItem = (item: AnyItem, kind: "nav" | "section") => {
    const active = item.id === activeId;
    const Icon = item.icon;
    const sectionItem = kind === "section" ? item as ScreenShellSectionItem : null;
    const count = item.count;
    // Tone and color tint the icon itself; an item without icon or avatar gets a quiet # glyph, never a coloured dot.
    const tint = sectionItem?.color ?? (sectionItem?.tone ? `var(--tone-${sectionItem.tone})` : undefined);
    const Glyph = Icon ?? Hash;
    const marker = sectionItem?.avatar && !Icon
      // eslint-disable-next-line @next/next/no-img-element
      ? <img className={styles.itemAvatar} src={sectionItem.avatar} alt="" width={16} height={16} />
      : <Glyph size={16} strokeWidth={1.75} className={styles.itemIcon} data-tone={tint ? "" : undefined} style={tint ? { "--ss-tone": tint } as CSSProperties : undefined} aria-hidden="true" />;
    const trailing = "dot" in item && item.dot || sectionItem?.unread;
    return <button key={item.id} type="button" data-ss-item="" className={styles.item} data-kind={kind} aria-current={active ? "page" : undefined}
      aria-label={collapsed ? `${item.label}${count !== undefined ? `, ${count}` : ""}` : undefined}
      onClick={event => navigate(item.id, event.detail === 0)}
      onPointerEnter={event => showTip(count !== undefined ? `${item.label} · ${count}` : item.label, event.currentTarget)} onPointerLeave={hideTip}
      onFocus={event => { if (event.currentTarget.matches(":focus-visible")) showTip(item.label, event.currentTarget); }} onBlur={hideTip}>
      {active && <span className={styles.itemActive} aria-hidden="true" />}
      <span className={styles.itemMarker}>{marker}</span>
      <span className={styles.itemLabel}>{item.label}</span>
      {count !== undefined && <span className={styles.itemCount}>{count}</span>}
      {trailing && count === undefined && <span className={styles.itemUnread} aria-label="New" />}
    </button>;
  };

  const headerNode = header == null || header === false ? null : isHeaderConfig(header)
    ? <HeaderBar header={header} panelToggle={panel && panel.toggle !== false ? { open: panelOpen, onToggle: () => setPanelOpen(!panelOpen), label: panel.label ?? "Details" } : null} />
    : header;

  return <ShellContext.Provider value={context}>
    <div ref={rootRef} className={cx(styles.root, className)} style={{ ...style, "--ss-panel-w": `${panelWidth}px` } as CSSProperties} data-variant={variant} data-size={size}
      data-collapsed={collapsed ? "" : undefined} data-sheet={sheetOpen ? "" : undefined} data-panel-sheet={panelSheetOpen ? "" : undefined} data-resizing={resizing ? "" : undefined}>
      <div className={styles.frame}>
        <motion.aside ref={sidebarRef} id={`${uid}-sidebar`} className={styles.sidebar} aria-label={ariaLabel} inert={sidebarHidden || undefined}
          initial={false} animate={{ width: compact ? 288 : collapsed ? RAIL_WIDTH : SIDEBAR_WIDTH }} transition={compact ? instant : morph} onKeyDown={onSidebarKeyDown}>
          {/* Workspace */}
          <div className={styles.top}>
            {/* One button in both states, so the name fades with the width instead of swapping out. In the rail it expands the sidebar. */}
            <button type="button" className={styles.workspace} aria-label={collapsed ? "Expand sidebar" : undefined} aria-haspopup={collapsed ? undefined : "menu"}
              aria-expanded={collapsed ? undefined : menu?.kind === "workspace"} data-open={menu?.kind === "workspace" ? "" : undefined}
              onClick={event => collapsed ? setCollapsed(false) : openMenu("workspace", event.currentTarget)}
              onPointerEnter={event => showTip("Expand sidebar", event.currentTarget)} onPointerLeave={hideTip}>
              <span className={styles.workspaceMark}>
                <span className={styles.workspaceLogo}>{currentWorkspace.mark ?? <ScreenShellMark name={currentWorkspace.name} tone={currentWorkspace.tone} />}</span>
                <PanelLeft size={16} strokeWidth={1.75} className={styles.railExpand} aria-hidden="true" />
              </span>
              <span className={styles.workspaceName}>{currentWorkspace.name}</span>
              <ChevronDown size={14} strokeWidth={1.75} className={styles.workspaceChevron} aria-hidden="true" />
            </button>
            {compact
              ? <button type="button" className={cx(styles.iconButton, styles.topToggle)} aria-label="Close navigation" onClick={closeSidebar}><X size={16} strokeWidth={1.75} aria-hidden="true" /></button>
              : <button type="button" className={cx(styles.iconButton, styles.topToggle)} aria-label="Collapse sidebar" tabIndex={collapsed ? -1 : undefined} aria-hidden={collapsed || undefined} onClick={() => setCollapsed(true)}><PanelLeft size={16} strokeWidth={1.75} aria-hidden="true" /></button>}
          </div>

          {/* Search */}
          {searchConfig && <div className={styles.searchRow}>
            {collapsed || searchConfig.onOpen
              ? <button type="button" className={styles.search} onClick={focusSearch} aria-label={collapsed ? "Search" : undefined} aria-keyshortcuts={searchConfig.hotkey === false ? undefined : "Meta+K Control+K"}
                onPointerEnter={event => showTip("Search", event.currentTarget, searchConfig.hotkey === false ? undefined : searchConfig.shortcut ?? "⌘K")} onPointerLeave={hideTip}>
                <Search size={16} strokeWidth={1.75} className={styles.searchIcon} aria-hidden="true" />
                <span className={styles.searchPlaceholder}>{searchConfig.placeholder ?? "Search"}</span>
                <Kbd size="sm" className={styles.kbd} aria-hidden="true">{searchConfig.shortcut ?? "⌘K"}</Kbd>
              </button>
              : <label className={styles.search} data-filled={query ? "" : undefined}>
                <Search size={16} strokeWidth={1.75} className={styles.searchIcon} aria-hidden="true" />
                <input ref={searchRef} className={styles.searchInput} type="search" value={query} placeholder={searchConfig.placeholder ?? "Search"} aria-label={searchConfig.placeholder ?? "Search"}
                  aria-keyshortcuts={searchConfig.hotkey === false ? undefined : "Meta+K Control+K"} autoComplete="off" spellCheck={false}
                  onChange={event => setQuery(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Escape") { event.preventDefault(); if (query) setQuery(""); else event.currentTarget.blur(); }
                    if (event.key === "Enter" && results?.[0]) { navigate(results[0].id, true); setQuery(""); }
                    if (event.key === "ArrowDown" && results?.length) { event.preventDefault(); sidebarRef.current?.querySelector<HTMLElement>("[data-ss-item]")?.focus(); }
                  }} />
                {query
                  ? <button type="button" className={styles.searchClear} aria-label="Clear search" onClick={() => { setQuery(""); searchRef.current?.focus(); }}><X size={14} strokeWidth={1.75} aria-hidden="true" /></button>
                  : <Kbd size="sm" className={styles.kbd} aria-hidden="true">{searchConfig.shortcut ?? "⌘K"}</Kbd>}
              </label>}
          </div>}

          {sidebarTop != null && sidebarTop !== false && <RailFold hidden={collapsed} reduce={reduce} className={styles.foldTop}>{sidebarTop}</RailFold>}

          {/* Navigation */}
          <SidebarScroll>
            {results
              ? <div className={styles.results} role="group" aria-label="Search results">
                {results.length
                  ? results.map(item => renderItem(item, nav.includes(item as ScreenShellNavItem) ? "nav" : "section"))
                  : <p className={styles.noResults}>No matches for “{query.trim()}”</p>}
              </div>
              : <>
                <nav className={styles.nav} aria-label="Primary">{nav.map(item => renderItem(item, "nav"))}</nav>
                {sections?.map(section => <SidebarSection key={section.id} section={section} hidden={collapsed} reduce={reduce} renderItem={item => renderItem(item, "section")}
                  onExpand={() => setCollapsed(false)} onTip={showTip} onTipEnd={hideTip} />)}
              </>}
          </SidebarScroll>

          {/* Cards and account */}
          <div className={styles.bottom}>
            {sidebarFooter != null && sidebarFooter !== false && <RailFold hidden={collapsed} reduce={reduce} className={styles.foldFooter}>{sidebarFooter}</RailFold>}
            {cards && <SidebarCards cards={cards} hidden={collapsed} reduce={reduce} />}
            {account && (account.menu?.length
              ? <button type="button" className={styles.account} aria-haspopup="menu" aria-expanded={menu?.kind === "account"} data-open={menu?.kind === "account" ? "" : undefined}
                aria-label={collapsed ? `${account.name}, account menu` : undefined}
                onClick={event => openMenu("account", event.currentTarget)} onPointerEnter={event => showTip(account.name, event.currentTarget)} onPointerLeave={hideTip}>
                <Avatar name={account.name} src={account.avatar} />
                <span className={styles.accountText}><span className={styles.accountName}>{account.name}</span>{account.detail && <span className={styles.accountDetail}>{account.detail}</span>}</span>
                <ChevronsUpDown size={14} strokeWidth={1.75} className={styles.accountChevron} aria-hidden="true" />
              </button>
              : <div className={styles.account} data-static="">
                <Avatar name={account.name} src={account.avatar} />
                <span className={styles.accountText}><span className={styles.accountName}>{account.name}</span>{account.detail && <span className={styles.accountDetail}>{account.detail}</span>}</span>
              </div>)}
          </div>
        </motion.aside>

        <div className={styles.body}>
          <div className={styles.main} inert={(compact && sheetOpen) || panelSheetOpen || undefined}>
            {headerNode ?? <div className={styles.compactBar}><ScreenShellMenuButton /><span className={styles.compactName}>{currentWorkspace.name}</span></div>}
            {scroll
              ? <MainScroll padding={padding}>{children}</MainScroll>
              : <div className={styles.static} data-padding={padding}>{children}</div>}
          </div>

          {panel && (docked
            ? <AnimatePresence initial={false}>
              {panelOpen && <motion.aside key="panel" className={styles.panel} aria-label={panel.label ?? "Details"}
                initial={{ width: 0, marginLeft: 0, opacity: 0 }} animate={{ width: panelWidth, marginLeft: variant === "inset" ? 8 : 0, opacity: 1 }} exit={{ width: 0, marginLeft: 0, opacity: 0 }}
                transition={resizing ? instant : { ...morph, opacity: reduce ? instant : { duration: motionTokens.duration.fast } }}>
                {panel.resizable !== false && <div className={styles.handle} role="separator" aria-orientation="vertical" aria-label={`Resize ${(panel.label ?? "details").toLowerCase()} panel`}
                  aria-valuenow={Math.round(panelWidth)} aria-valuemin={minPanel} aria-valuemax={maxPanel} tabIndex={0}
                  onPointerDown={onHandleDown} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerCancel={onHandleUp} onKeyDown={onHandleKey} onDoubleClick={() => setPanelWidth(Math.min(maxPanel, Math.max(minPanel, panel.defaultWidth ?? 320)))} />}
                <div className={styles.panelInner}>{panel.content}</div>
              </motion.aside>}
            </AnimatePresence>
            : <aside className={styles.panel} data-sheet="" aria-label={panel.label ?? "Details"} inert={!panelOpen || undefined}>
              <div className={styles.panelSheetTop}><button type="button" className={styles.iconButton} aria-label={`Close ${(panel.label ?? "details").toLowerCase()}`} onClick={() => setPanelOpen(false)}><X size={16} strokeWidth={1.75} aria-hidden="true" /></button></div>
              <div className={styles.panelInner}>{panel.content}</div>
            </aside>)}
        </div>
      </div>

      {/* Scrims for the two sheets */}
      <div className={styles.scrim} data-for="sidebar" aria-hidden="true" onClick={closeSidebar} />
      <div className={styles.scrim} data-for="panel" aria-hidden="true" onClick={() => setPanelOpen(false)} />

      {tip && collapsed && <span key={tip.label} className={styles.tip} style={{ top: tip.top, left: RAIL_WIDTH + 6 }} role="tooltip">{tip.label}{tip.shortcut && <kbd className={styles.tipKey}>{tip.shortcut}</kbd>}</span>}

      <AnimatePresence>
        {menu?.kind === "workspace" && <MenuList key="workspace" state={menu} label="Workspace" onClose={closeMenu}>
          {options.length > 0 && <div className={styles.menuGroup} role="group" aria-label="Switch workspace">
            {options.map(option => <button key={option.id} type="button" role="menuitemradio" aria-checked={option.id === workspaceId} className={styles.menuItem} data-tall=""
              onClick={() => { setWorkspaceId(option.id); workspace.onSelect?.(option.id); closeMenu(true); }}>
              {option.mark ?? <ScreenShellMark name={option.name} tone={option.tone} size={24} />}
              <span className={styles.menuText}><span className={styles.menuLabel}>{option.name}</span>{option.detail && <span className={styles.menuDetail}>{option.detail}</span>}</span>
              {option.id === workspaceId && <Check size={14} strokeWidth={2} className={styles.menuCheck} aria-hidden="true" />}
            </button>)}
          </div>}
          {workspace.actions && <MenuItems items={workspace.actions.map((item, index) => index === 0 && options.length ? { ...item, separatorBefore: true } : item)} onDone={() => closeMenu(true)} />}
          {!options.length && !workspace.actions?.length && <p className={styles.menuEmpty}>{currentWorkspace.name}</p>}
        </MenuList>}
        {menu?.kind === "account" && account?.menu && <MenuList key="account" state={menu} label="Account" onClose={closeMenu}>
          <div className={styles.menuHead}>
            <Avatar name={account.name} src={account.avatar} />
            <span className={styles.menuText}><span className={styles.menuLabel}>{account.name}</span>{account.detail && <span className={styles.menuDetail}>{account.detail}</span>}</span>
          </div>
          <MenuItems items={account.menu} onDone={() => closeMenu(true)} />
        </MenuList>}
      </AnimatePresence>
    </div>
  </ShellContext.Provider>;
}

/* ------------------------------------------------------------------------------------------------
 * Parts
 * ---------------------------------------------------------------------------------------------- */

function SidebarScroll({ children }: { children: ReactNode }) {
  const ref = useEdgeFade<HTMLDivElement>();
  return <div ref={ref} className={styles.sidebarScroll}><div className={styles.sidebarScrollInner}>{children}</div></div>;
}

function MainScroll({ padding, children }: { padding: "default" | "none"; children: ReactNode }) {
  const ref = useEdgeFade<HTMLDivElement>();
  return <div ref={ref} className={styles.scroll} data-padding={padding}><div className={styles.content}>{children}</div></div>;
}

/** Keeps app specific content mounted (so its own state survives the rail) and folds it away on the smooth spring while collapsed. */
function RailFold({ hidden, reduce, className, children }: { hidden: boolean; reduce: boolean; className?: string; children: ReactNode }) {
  return <motion.div className={styles.fold} initial={false} animate={{ height: hidden ? 0 : "auto", opacity: hidden ? 0 : 1 }} inert={hidden || undefined} aria-hidden={hidden || undefined}
    transition={reduce ? instant : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } }}>
    <div className={cx(styles.foldInner, className)}>{children}</div>
  </motion.div>;
}

type SectionProps = {
  section: ScreenShellSection; hidden: boolean; reduce: boolean; renderItem: (item: ScreenShellSectionItem) => ReactNode;
  onExpand: () => void; onTip: (label: string, element: HTMLElement) => void; onTipEnd: () => void;
};

function SidebarSection({ section, hidden, reduce, renderItem, onExpand, onTip, onTipEnd }: SectionProps) {
  const [open, setOpen] = useState(section.defaultOpen ?? true);
  const collapsible = section.collapsible !== false;
  const bodyId = useId();
  const Action = section.action?.icon ?? Plus;
  const Icon = section.icon;
  // In the rail a section with an icon keeps it as a row that expands the sidebar; everything else in the section hides.
  const railRow = hidden && Boolean(Icon);
  const heading = <>
    {Icon && <Icon size={16} strokeWidth={1.75} className={styles.sectionIcon} aria-hidden="true" />}
    <span className={styles.sectionText}>{section.label}</span>
  </>;
  return <div className={styles.section} data-hidden={hidden ? "" : undefined} data-icon={Icon ? "" : undefined} inert={(hidden && !Icon) || undefined}>
    <div className={styles.sectionHead}>
      {railRow
        ? <button type="button" className={styles.sectionToggle} aria-label={`${section.label}, expand sidebar`} onClick={onExpand}
          onPointerEnter={event => onTip(section.label, event.currentTarget)} onPointerLeave={onTipEnd}
          onFocus={event => { if (event.currentTarget.matches(":focus-visible")) onTip(section.label, event.currentTarget); }} onBlur={onTipEnd}>{heading}</button>
        : collapsible
          ? <button type="button" className={styles.sectionToggle} aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(value => !value)}>
            {heading}
            <ChevronRight size={12} strokeWidth={2} className={styles.sectionChevron} data-open={open ? "" : undefined} aria-hidden="true" />
          </button>
          : <span className={styles.sectionLabel}>{heading}</span>}
      {section.action && <button type="button" className={styles.sectionAction} aria-label={section.action.label} title={section.action.label} onClick={section.action.onSelect} inert={hidden || undefined}><Action size={14} strokeWidth={1.75} aria-hidden="true" /></button>}
    </div>
    <AnimatePresence initial={false}>
      {open && <motion.div id={bodyId} key="body" className={styles.sectionBody} role="group" aria-label={section.label} inert={hidden || undefined}
        initial={{ height: 0, opacity: 0 }} animate={{ height: railRow ? 0 : "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0, transition: reduce ? instant : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.exit } } }}
        transition={reduce ? instant : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard } }}>
        {section.content != null && section.content !== false ? <div className={styles.sectionContent}>{section.content}</div> : section.items.map(renderItem)}
      </motion.div>}
    </AnimatePresence>
  </div>;
}

function SidebarCards({ cards, hidden, reduce }: { cards: ScreenShellCards; hidden: boolean; reduce: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  const { whatsNew, progress } = cards;
  const share = progress ? Math.max(0, Math.min(1, progress.value / (progress.total ?? 100))) : 0;
  const show = !hidden && ((whatsNew && !dismissed) || progress);
  const fold: Transition = reduce ? instant : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } };
  const progressBody = progress && <>
    <span className={styles.cardRow}>
      <span className={styles.cardTitle}>{progress.title}</span>
      {progress.onSelect && <ChevronRight size={14} strokeWidth={1.75} className={styles.cardArrow} aria-hidden="true" />}
    </span>
    <span className={styles.cardBody}>{progress.detail ?? `${progress.value} of ${progress.total ?? 100}`}</span>
    <span className={styles.bar} role="progressbar" aria-label={progress.title} aria-valuemin={0} aria-valuemax={progress.total ?? 100} aria-valuenow={progress.value}>
      <motion.span className={styles.barFill} initial={false} animate={{ scaleX: share }} transition={reduce ? instant : motionTokens.spring.smooth} />
    </span>
  </>;
  return <AnimatePresence initial={false}>
    {show && <motion.div key="cards" className={styles.cards} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={fold}>
      <div className={styles.cardsInner}>
        <AnimatePresence initial={false}>
          {whatsNew && !dismissed && <motion.div key="new" className={styles.cardFold} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={fold}>
            <div className={styles.card}>
              <span className={styles.cardRow}>
                <span className={styles.cardTitle}><span className={styles.cardDot} aria-hidden="true" />{whatsNew.title}</span>
                <button type="button" className={styles.cardClose} aria-label={`Dismiss ${whatsNew.title}`} onClick={() => { setDismissed(true); whatsNew.onDismiss?.(); }}><X size={14} strokeWidth={1.75} aria-hidden="true" /></button>
              </span>
              {whatsNew.body && <span className={styles.cardBody}>{whatsNew.body}</span>}
              {whatsNew.action && <button type="button" className={styles.cardLink} onClick={whatsNew.action.onSelect}>{whatsNew.action.label}<ChevronRight size={13} strokeWidth={1.75} aria-hidden="true" /></button>}
            </div>
          </motion.div>}
        </AnimatePresence>
        {progress && (progress.onSelect
          ? <button type="button" className={cx(styles.card, styles.cardButton)} onClick={progress.onSelect}>{progressBody}</button>
          : <div className={styles.card}>{progressBody}</div>)}
      </div>
    </motion.div>}
  </AnimatePresence>;
}

function HeaderBar({ header, panelToggle }: { header: ScreenShellHeader; panelToggle: { open: boolean; onToggle: () => void; label: string } | null }) {
  return <header className={styles.header}>
    <div className={styles.headerRow}>
      <ScreenShellMenuButton />
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        {header.breadcrumbs?.map(crumb => <span key={crumb.id} className={styles.crumb}>
          {crumb.onSelect ? <button type="button" className={styles.crumbButton} onClick={crumb.onSelect}>{crumb.label}</button> : <span className={styles.crumbText}>{crumb.label}</span>}
          <ChevronRight size={13} strokeWidth={1.75} className={styles.crumbSep} aria-hidden="true" />
        </span>)}
        <span className={styles.title} aria-current="page">{header.title}</span>
        {header.meta && <span className={styles.meta}>{header.meta}</span>}
      </nav>
      {(header.actions || panelToggle) && <div className={styles.headerActions}>
        {header.actions}
        {panelToggle && <button type="button" className={styles.iconButton} aria-label={panelToggle.open ? `Hide ${panelToggle.label.toLowerCase()}` : `Show ${panelToggle.label.toLowerCase()}`} aria-pressed={panelToggle.open} onClick={panelToggle.onToggle}><PanelRight size={16} strokeWidth={1.75} aria-hidden="true" /></button>}
      </div>}
    </div>
    {header.below && <div className={styles.headerBelow}>{header.below}</div>}
  </header>;
}

export default ScreenShell;


/* ------------------------------------------------------------------------------------------------
 * App alignment (team-tracker): one shared nav, team switcher and account for every screen.
 * Screens keep their own pages; they move into a section under the app nav.
 * ---------------------------------------------------------------------------------------------- */

export interface ScreenShellAppConfig {
  /** App-wide nav, shown on every screen. Ids are routes such as "/tasks". */
  nav: ScreenShellNavItem[];
  /** The current route id, marked with a dot. */
  currentId?: string;
  onNavigate: (id: string) => void;
  /** Replaces each screen's sample workspace; options are the teams. */
  workspace: ScreenShellWorkspace;
  account?: ScreenShellAccount;
  /** Heading for the screen's own pages. Default "This screen". */
  screenLabel?: string;
  /** App content under the search field on every screen, such as the daily check-in button. */
  sidebarTop?: ReactNode;
}

const ScreenShellAppContext = createContext<ScreenShellAppConfig | null>(null);

export function ScreenShellAppProvider({ value, children }: { value: ScreenShellAppConfig; children: ReactNode }) {
  return <ScreenShellAppContext.Provider value={value}>{children}</ScreenShellAppContext.Provider>;
}

/** Reads the app config, so a page can extend it (for example add its own sidebarTop). */
export function useScreenShellApp() {
  return useContext(ScreenShellAppContext);
}

export function ScreenShell(props: ScreenShellProps) {
  const app = useContext(ScreenShellAppContext);
  if (!app) return <ScreenShellBase {...props} />;
  const appIds = new Set(app.nav.map(item => item.id));
  const screenSection: ScreenShellSection | null = props.nav.length > 1
    ? { id: "screen-pages", label: app.screenLabel ?? "This screen", items: props.nav.map(item => ({ id: item.id, label: item.label, icon: item.icon, count: item.count, unread: item.dot })) }
    : null;
  const nav = app.nav.map(item => item.id === app.currentId ? { ...item, dot: true } : item);
  const screenDefault = props.nav.length > 1 ? (props.defaultActiveId ?? props.nav[0]?.id) : app.currentId;
  return <ScreenShellBase
    {...props}
    workspace={app.workspace}
    account={app.account ?? props.account}
    nav={nav}
    sections={[...(screenSection ? [screenSection] : []), ...(props.sections ?? [])]}
    activeId={props.nav.length > 1 ? props.activeId : app.currentId}
    defaultActiveId={screenDefault}
    onNavigate={(id, item) => { if (appIds.has(id)) app.onNavigate(id); else props.onNavigate?.(id, item); }}
    sidebarTop={app.sidebarTop || props.sidebarTop ? <>{app.sidebarTop}{props.sidebarTop}</> : undefined}
  />;
}
