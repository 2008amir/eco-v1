import { Link } from "@tanstack/react-router";
import logoSrc from "@/assets/logo.png";

export function Logo({ to = "/", onClick }: { to?: string; onClick?: () => void }) {
  const content = (
    <>
      <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full gradient-bg glow p-[2px]">
        <img
          src={logoSrc}
          alt="Ecomedic Squad logo"
          className="h-full w-full rounded-full object-cover logo-tint group-hover:scale-105 transition-transform"
        />
      </span>
      <div className="leading-tight text-left">
        <div className="font-bold text-base gradient-text">Ecomedic</div>
        <div className="text-[10px] uppercase tracking-widest text-primary/80 -mt-0.5">Squad</div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 group"
        aria-label="Open site menu"
      >
        {content}
      </button>
    );
  }

  return (
    <Link to={to} className="flex items-center gap-2 group">
      {content}
    </Link>
  );
}
