export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-foreground">Module scaffold</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Replace this page — see CONTRIBUTING.md at the repo root for the module contract
        (claiming a schema, RLS pattern, and where to register this module in
        <code className="mx-1 rounded bg-muted px-1 py-0.5">platform.modules</code>).
      </p>
    </div>
  );
}
