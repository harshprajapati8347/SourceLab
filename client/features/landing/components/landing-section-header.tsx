type LandingSectionHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function LandingSectionHeader({
  eyebrow,
  title,
  description,
}: LandingSectionHeaderProps) {
  return (
    <div className="mx-auto mb-12 max-w-xl text-center">
      <p className="mb-3 text-xs font-semibold text-primary">{eyebrow}</p>
      <h2 className="font-heading text-balance text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
