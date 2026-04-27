/**
 * Empty-state copy for surfaces that list the actor's Player rows.
 * Kept as a standalone component so the dashboard's My Characters
 * column and the `/characters` route share the exact same copy.
 */
export function CharactersEmptyState() {
  return (
    <p
      className="rounded-md border bg-muted px-4 py-6 text-center text-sm text-muted-foreground"
      data-testid="characters-empty-state"
    >
      You haven&apos;t been invited to any games yet. When a GM invites you, your
      character will appear here.
    </p>
  );
}
