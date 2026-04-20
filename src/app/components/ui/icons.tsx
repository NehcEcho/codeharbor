import type { SVGProps } from "react";
import * as LucideIcons from "lucide-react";

type IconProps = SVGProps<SVGSVGElement>;

function fallbackIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

function resolveIcon(name: string) {
  const iconMap = LucideIcons as unknown as Record<string, React.ComponentType<IconProps>>;
  return iconMap[name] || fallbackIcon;
}

export const ActivityIcon = resolveIcon("Activity");
export const AlertCircleIcon = resolveIcon("CircleAlert");
export const AlertTriangleIcon = resolveIcon("TriangleAlert");
export const ArrowUpIcon = resolveIcon("ArrowUp");
export const ArrowDownIcon = resolveIcon("ArrowDown");
export const BotIcon = resolveIcon("Bot");
export const CheckCircleIcon = resolveIcon("CircleCheckBig");
export const CheckIcon = resolveIcon("Check");
export const ChevronDownIcon = resolveIcon("ChevronDown");
export const ChevronRightIcon = resolveIcon("ChevronRight");
export const GlobeIcon = resolveIcon("Globe");
export const GitCommitIcon = resolveIcon("GitCommitHorizontal");
export const LightbulbIcon = resolveIcon("Lightbulb");
export const LockIcon = resolveIcon("Lock");
export const MenuIcon = resolveIcon("Menu");
export const MessageSquareIcon = resolveIcon("BotMessageSquare");
export const PaperclipIcon = resolveIcon("Paperclip");
export const PlusIcon = resolveIcon("Plus");
export const SearchIcon = resolveIcon("Search");
export const RefreshCwIcon = resolveIcon("RefreshCw");
export const ServerIcon = resolveIcon("Server");
export const SettingsIcon = resolveIcon("Settings");
export const Settings2Icon = resolveIcon("Settings2");
export const ShieldAlertIcon = resolveIcon("ShieldAlert");
export const TerminalIcon = resolveIcon("SquareTerminal");
export const UserIcon = resolveIcon("User");
export const WrenchIcon = resolveIcon("Wrench");
export const XIcon = resolveIcon("X");
export const ZapIcon = resolveIcon("Zap");
export const FileCodeIcon = resolveIcon("FileCode");
export const ClockIcon = resolveIcon("Clock");
