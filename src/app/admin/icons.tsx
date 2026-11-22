/**
 * Small hand-authored outline icon set for the admin dashboard. Deliberately
 * not emoji — emoji render inconsistently across OS/browser combinations
 * and read as informal in front of an audience being pitched this as a
 * paid product. Consistent stroke width/size so they drop into the same
 * icon-tile treatment everywhere.
 */

const common = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function FolderIcon() {
  return (
    <svg {...common} className="h-6 w-6" aria-hidden>
      <path d="M3.5 6.5a1 1 0 0 1 1-1h4.379a1 1 0 0 1 .707.293l1.414 1.414a1 1 0 0 0 .707.293H19.5a1 1 0 0 1 1 1V17.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-11Z" />
    </svg>
  );
}

export function GavelIcon() {
  return (
    <svg {...common} className="h-6 w-6" aria-hidden>
      <path d="m13.2 4.8 4 4M9.5 8.5l6 6M4 20l5-5M6.8 11.8l3.6-3.6a1 1 0 0 1 1.4 0l3 3a1 1 0 0 1 0 1.4l-3.6 3.6a1 1 0 0 1-1.4 0l-3-3a1 1 0 0 1 0-1.4Z" />
    </svg>
  );
}

export function CreditCardIcon() {
  return (
    <svg {...common} className="h-6 w-6" aria-hidden>
      <rect x="3" y="5.5" width="18" height="13" rx="1.8" />
      <path d="M3 9.5h18" />
      <path d="M6 14.5h4" />
    </svg>
  );
}

export function DeviceMobileIcon() {
  return (
    <svg {...common} className="h-6 w-6" aria-hidden>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18.5h2" />
    </svg>
  );
}

export function SyncIcon() {
  return (
    <svg {...common} className="h-6 w-6" aria-hidden>
      <path d="M4 12a8 8 0 0 1 13.66-5.66M20 12a8 8 0 0 1-13.66 5.66" />
      <path d="M17 3v4h-4M7 21v-4h4" />
    </svg>
  );
}

export function UploadIcon() {
  return (
    <svg {...common} className="h-6 w-6" aria-hidden>
      <path d="M12 15.5V4M8 8l4-4 4 4" />
      <path d="M4.5 15.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export function CheckCircleIcon() {
  return (
    <svg {...common} className="h-4 w-4 shrink-0" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </svg>
  );
}

export function WarningIcon() {
  return (
    <svg {...common} className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M10.7 3.9 2.9 17.5a1.5 1.5 0 0 0 1.3 2.2h15.6a1.5 1.5 0 0 0 1.3-2.2L13.3 3.9a1.5 1.5 0 0 0-2.6 0Z" />
      <path d="M12 9.5v4M12 16.3v.1" />
    </svg>
  );
}

export function PlayCircleIcon() {
  return (
    <svg {...common} className="h-6 w-6" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M10.2 8.7v6.6l5.4-3.3-5.4-3.3Z" />
    </svg>
  );
}

export function MonitorIcon() {
  return (
    <svg {...common} className="h-6 w-6" aria-hidden>
      <rect x="3" y="4.5" width="18" height="12" rx="1.5" />
      <path d="M8.5 20.5h7M12 16.5v4" />
    </svg>
  );
}

export function BookOpenIcon() {
  return (
    <svg {...common} className="h-6 w-6" aria-hidden>
      <path d="M12 6.5c-1.5-1.3-3.6-2-6.5-2-.8 0-1.5.7-1.5 1.5v11c0 .8.7 1.5 1.5 1.5 2.9 0 5 .7 6.5 2M12 6.5c1.5-1.3 3.6-2 6.5-2 .8 0 1.5.7 1.5 1.5v11c0 .8-.7 1.5-1.5 1.5-2.9 0-5 .7-6.5 2M12 6.5v14" />
    </svg>
  );
}

export function ClipboardListIcon() {
  return (
    <svg {...common} className="h-6 w-6" aria-hidden>
      <rect x="5" y="4" width="14" height="17" rx="1.8" />
      <path d="M9 3.5h6a.5.5 0 0 1 .5.5v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1a.5.5 0 0 1 .5-.5Z" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" />
    </svg>
  );
}

export function PulseIcon() {
  return (
    <svg {...common} className="h-6 w-6" aria-hidden>
      <path d="M3 12h3.5l2-6 3.5 12 2.5-9 1.5 3H21" />
    </svg>
  );
}

export function CameraIcon() {
  return (
    <svg {...common} className="h-6 w-6" aria-hidden>
      <path d="M4 8.5a1.5 1.5 0 0 1 1.5-1.5h1.6l1-1.6a1 1 0 0 1 .85-.4h6.1a1 1 0 0 1 .85.4l1 1.6h1.6A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}

export function GiftIcon() {
  return (
    <svg {...common} className="h-6 w-6" aria-hidden>
      <path d="M4 9.5h16V13H4zM5.5 13H18.5V19.5H5.5zM12 9.5V19.5" />
      <path d="M12 9.5c-1.2 0-3.5-.4-3.5-2.4S10.3 4.5 12 7c1.7-2.5 3.5-1.9 3.5-.1s-2.3 2.6-3.5 2.6Z" />
    </svg>
  );
}

export function PackageIcon() {
  return (
    <svg {...common} className="h-6 w-6" aria-hidden>
      <path d="M12 3.5 4 7.5v9l8 4 8-4v-9Z" />
      <path d="M4 7.5 12 11.5M12 11.5 20 7.5M12 11.5V20.5" />
    </svg>
  );
}

export function UsersIcon() {
  return (
    <svg {...common} className="h-6 w-6" aria-hidden>
      <circle cx="9" cy="8" r="2.6" />
      <path d="M3.8 18c.6-2.8 2.6-4.3 5.2-4.3s4.6 1.5 5.2 4.3" />
      <circle cx="16.3" cy="8.5" r="2.1" />
      <path d="M14.8 13.8c2 .2 3.4 1.6 3.9 3.8" />
    </svg>
  );
}

export function DocumentIcon() {
  return (
    <svg {...common} className="h-6 w-6" aria-hidden>
      <path d="M7 3.5h7l3.5 3.5V20.5h-10.5Z" />
      <path d="M14 3.5v3.5h3.5M9 12h6M9 15.5h6" />
    </svg>
  );
}

export function CheckInDoorIcon() {
  return (
    <svg {...common} className="h-6 w-6" aria-hidden>
      <path d="M8 3.5h8v17H8Z" />
      <path d="M3.5 12h5M6 9.8 8.5 12 6 14.2" />
    </svg>
  );
}
