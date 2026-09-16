import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  CircleUserRound,
  FileSearch,
  ImagePlus,
  Laptop,
  Library,
  LogOut,
  MapPin,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Smartphone,
  TicketCheck,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GSU Item Matching & Recovery" },
      {
        name: "description",
        content: "Report, match, claim, and recover lost items across Gombe State University.",
      },
      { property: "og:title", content: "GSU Item Matching & Recovery" },
      {
        property: "og:description",
        content: "A campus recovery desk for Gombe State University students and staff.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type LostItem = Database["public"]["Tables"]["lost_items"]["Row"];
type FoundItem = Database["public"]["Tables"]["found_items"]["Row"];
type Match = Database["public"]["Tables"]["matches"]["Row"];
type Claim = Database["public"]["Tables"]["claims"]["Row"];
type Mode = "lost" | "found";
type View = "home" | "items" | "matches" | "admin";

const faculties = [
  "Faculty of Science",
  "Faculty of Education",
  "Faculty of Arts",
  "Faculty of Law",
  "Faculty of Social Sciences",
];
const departments = [
  "Computer Science",
  "Economics",
  "Mass Communication",
  "English",
  "Law",
  "Biological Sciences",
  "Education",
  "Accounting",
];
const locations = [
  "GSU Library",
  "Faculty of Science",
  "Faculty of Arts",
  "Male Hostel",
  "Female Hostel",
  "Central Mosque",
  "Cafeteria",
  "GSU Main Gate",
];
const keptAt = ["SUG Office", "Faculty Office", "Security Office"];
const categories: Array<Database["public"]["Enums"]["item_category"]> = [
  "electronics",
  "documents",
  "wallets",
  "keys",
  "bags",
  "clothing",
  "books",
  "accessories",
  "other",
];

function HomePage() {
  const [session, setSession] = useState<{ user: { id: string; email: string } } | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState({ lost: 0, found: 0, matches: 0, notifications: 0 });
  const [view, setView] = useState<View>("home");
  const [mode, setMode] = useState<Mode>("lost");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [showAuth, setShowAuth] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportMode, setReportMode] = useState<Mode>("lost");
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(
          data.session
            ? { user: { id: data.session.user.id, email: data.session.user.email ?? "" } }
            : null,
        );
        setLoadingSession(false);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(
        nextSession ? { user: { id: nextSession.user.id, email: nextSession.user.email ?? "" } } : null,
      );
      if (!nextSession) {
        setProfile(null);
        setIsAdmin(false);
      }
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    const loadIdentity = async () => {
      const [
        { data: nextProfile },
        { data: roleRows },
        lostCount,
        foundCount,
        userLostItems,
        userFoundItems,
        claimRows,
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", session.user.id),
        supabase
          .from("lost_items")
          .select("id", { count: "exact", head: true })
          .eq("reporter_id", session.user.id),
        supabase
          .from("found_items")
          .select("id", { count: "exact", head: true })
          .eq("reporter_id", session.user.id),
        supabase.from("lost_items").select("id").eq("reporter_id", session.user.id),
        supabase.from("found_items").select("id").eq("reporter_id", session.user.id),
        supabase
          .from("claims")
          .select("id")
          .eq("claimant_id", session.user.id)
          .eq("status", "pending"),
      ]);
      const lostIds = (userLostItems.data ?? []).map((item) => item.id);
      const foundIds = (userFoundItems.data ?? []).map((item) => item.id);
      let matchCount = 0;
      if (lostIds.length || foundIds.length) {
        const { data: matchRows } = await supabase
          .from("matches")
          .select("lost_item_id, found_item_id")
          .limit(100);
        matchCount = (matchRows ?? []).filter(
          (match) => lostIds.includes(match.lost_item_id) || foundIds.includes(match.found_item_id),
        ).length;
      }
      const recoveredProfile = nextProfile ?? {
        id: session.user.id,
        identifier: "",
        user_type: "student" as const,
        display_name: session.user.email?.split("@")[0] ?? "GSU member",
        email: session.user.email ?? null,
        department: "",
        faculty: "",
        avatar_path: null,
        is_verified: false,
        created_at: "",
        updated_at: "",
      };
      if (!nextProfile) {
        const { data: userData } = await supabase.auth.getUser();
        const metadata = userData.user?.user_metadata as Record<string, string> | undefined;
        const metadataProfile = {
          ...recoveredProfile,
          identifier: metadata?.["identifier"] ?? recoveredProfile.identifier,
          user_type:
            metadata?.["user_type"] === "staff" ? ("staff" as const) : recoveredProfile.user_type,
          display_name: metadata?.["display_name"] ?? recoveredProfile.display_name,
          department: metadata?.["department"] ?? recoveredProfile.department,
          faculty: metadata?.["faculty"] ?? recoveredProfile.faculty,
        };
        if (metadataProfile.identifier && metadataProfile.department && metadataProfile.faculty) {
          const { data: createdProfile } = await supabase
            .from("profiles")
            .upsert({
              id: metadataProfile.id,
              identifier: metadataProfile.identifier,
              user_type: metadataProfile.user_type,
              display_name: metadataProfile.display_name,
              email: metadataProfile.email,
              department: metadataProfile.department,
              faculty: metadataProfile.faculty,
            })
            .select()
            .maybeSingle();
          setProfile(createdProfile ?? metadataProfile);
        } else {
          setProfile(metadataProfile);
        }
      } else {
        setProfile(nextProfile);
      }
      setIsAdmin(Boolean(roleRows?.some((row) => row.role === "admin")));
      setStats({
        lost: lostCount.count ?? 0,
        found: foundCount.count ?? 0,
        matches: matchCount,
        notifications: claimRows.data?.length ?? 0,
      });
    };
    void loadIdentity();
  }, [session, refreshKey]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setView("home");
    setNotice("You have been signed out.");
  };

  if (loadingSession)
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        Loading recovery desk…
      </div>
    );
  if (!session)
    return (
      <AuthScreen mode={authMode} onModeChange={setAuthMode} onSuccess={() => setShowAuth(false)} />
    );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <span className="text-xs font-bold tracking-tight">GSU</span>
            </div>
            <div className="leading-tight">
              <p className="font-display text-sm font-bold tracking-tight">Item Match</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Tudun Wada Campus
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="relative rounded-xl"
              aria-label="Notifications"
              onClick={() => setView("matches")}
            >
              <Bell className="size-4" />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-destructive" />
            </Button>
            <Button
              variant="outline"
              className="hidden gap-2 rounded-xl sm:inline-flex"
              onClick={handleSignOut}
            >
              <CircleUserRound className="size-4" />
              <span className="max-w-28 truncate">
                {profile?.display_name ?? session.user.email}
              </span>
              <LogOut className="size-3.5 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl sm:hidden"
              onClick={handleSignOut}
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Campus recovery desk
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Good day, {profile?.display_name?.split(" ")[0] ?? "there"}.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Report an item, review possible matches, and help return what belongs to the GSU
              community.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setReportMode("lost");
                setShowReport(true);
              }}
              className="rounded-xl"
            >
              <Plus className="size-4" />
              Report lost item
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setReportMode("found");
                setShowReport(true);
              }}
              className="rounded-xl"
            >
              <Package className="size-4" />
              Report found item
            </Button>
          </div>
        </div>

        {notice && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
            <span>{notice}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setNotice("")}
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </Button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="My lost items"
            value={String(stats.lost)}
            icon={<Search />}
            tone="blue"
          />
          <StatCard
            label="My found items"
            value={String(stats.found)}
            icon={<Package />}
            tone="green"
          />
          <StatCard
            label="Possible matches"
            value={String(stats.matches)}
            icon={<TicketCheck />}
            tone="orange"
          />
          <StatCard
            label="Notifications"
            value={String(stats.notifications)}
            icon={<Bell />}
            tone="purple"
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0">
            {view === "home" && (
              <HomeFeed
                userId={session.user.id}
                mode={mode}
                onModeChange={setMode}
                onReport={() => setShowReport(true)}
                refreshKey={refreshKey}
                onClaim={() => {
                  setNotice("Claim request sent to the admin review queue.");
                  setRefreshKey((key) => key + 1);
                }}
              />
            )}
            {view === "items" && (
              <ItemBrowse mode={mode} onModeChange={setMode} refreshKey={refreshKey} />
            )}
            {view === "matches" && (
              <MatchesView
                userId={session.user.id}
                refreshKey={refreshKey}
                onClaim={() => {
                  setNotice("Claim request sent to the admin review queue.");
                  setRefreshKey((key) => key + 1);
                }}
              />
            )}
            {view === "admin" && isAdmin && (
              <AdminView refreshKey={refreshKey} onNotice={setNotice} />
            )}
            {view === "admin" && !isAdmin && (
              <EmptyState
                icon={<ShieldCheck />}
                title="Admin review"
                detail="Your account does not have the SUG or Security Admin role."
              />
            )}
          </section>

          <aside className="hidden space-y-4 lg:block">
            <ProfileCard profile={profile} />
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Recovery flow
              </p>
              <div className="mt-4 space-y-4">
                {[
                  ["01", "Report", "Add the item details and location."],
                  ["02", "Match", "Review similar reports automatically."],
                  ["03", "Recover", "Submit a claim for admin review."],
                ].map(([number, title, detail]) => (
                  <div className="flex gap-3" key={number}>
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary text-[10px] font-bold text-primary">
                      {number}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:backdrop-blur-none">
        <div className="mx-auto grid max-w-7xl grid-cols-4 px-2 py-2 lg:flex lg:justify-start lg:gap-2 lg:px-8 lg:py-0">
          <NavButton
            active={view === "home"}
            icon={<Library />}
            label="Home"
            onClick={() => setView("home")}
          />
          <NavButton
            active={view === "items"}
            icon={<FileSearch />}
            label="Browse"
            onClick={() => setView("items")}
          />
          <NavButton
            active={view === "matches"}
            icon={<TicketCheck />}
            label="Matches"
            onClick={() => setView("matches")}
          />
          <NavButton
            active={view === "admin"}
            icon={<ShieldCheck />}
            label={isAdmin ? "Admin" : "Account"}
            onClick={() => setView(isAdmin ? "admin" : "home")}
          />
        </div>
      </nav>

      {showReport && (
        <ReportDialog
          mode={reportMode}
          userId={session.user.id}
          onClose={() => setShowReport(false)}
          onSaved={() => {
            setShowReport(false);
            setRefreshKey((key) => key + 1);
            setNotice("Your report was added. Possible matches will appear here when available.");
          }}
        />
      )}
      {showAuth && (
        <AuthScreen
          mode={authMode}
          onModeChange={setAuthMode}
          onSuccess={() => setShowAuth(false)}
        />
      )}
    </div>
  );
}

function AuthScreen({
  mode,
  onModeChange,
  onSuccess,
}: {
  mode: "login" | "signup";
  onModeChange: (mode: "login" | "signup") => void;
  onSuccess: () => void;
}) {
  const [accountType, setAccountType] =
    useState<Database["public"]["Enums"]["user_type"]>("student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    identifier: "",
    email: "",
    password: "",
    displayName: "",
    faculty: faculties[0] ?? "Faculty of Science",
    department: departments[0] ?? "Computer Science",
  });
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const email = form.email.trim().toLowerCase();
    if (mode === "login") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: form.password,
      });
      if (signInError)
        setError(
          signInError.message.includes("Invalid")
            ? "Those sign-in details could not be verified."
            : signInError.message,
        );
      else onSuccess();
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: {
            identifier: form.identifier.trim(),
            user_type: accountType,
            display_name: form.displayName.trim(),
            department: form.department,
            faculty: form.faculty,
          },
          emailRedirectTo: window.location.origin,
        },
      });
      if (signUpError) setError(signUpError.message);
      else if (data.user) {
        if (data.session) {
          const { error: profileError } = await supabase
            .from("profiles")
            .upsert({
              id: data.user.id,
              identifier: form.identifier.trim(),
              user_type: accountType,
              display_name: form.displayName.trim(),
              email,
              department: form.department,
              faculty: form.faculty,
            });
          if (profileError) setError(profileError.message);
          else {
            setError("Account created. Check your email to confirm your account, then sign in.");
            onModeChange("login");
          }
        } else {
          setError("Account created. Check your email to confirm your account, then sign in.");
          onModeChange("login");
        }
      }
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4 py-8">
        <div className="w-full rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
              <span className="text-xs font-bold">GSU</span>
            </div>
            <div>
              <p className="font-display text-lg font-bold">Item Match</p>
              <p className="text-xs text-muted-foreground">Tudun Wada recovery desk</p>
            </div>
          </div>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {mode === "login" ? "Welcome back" : "Join the recovery desk"}
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
              {mode === "login" ? "Sign in to GSU Item Match" : "Create your campus account"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {mode === "login"
                ? "Use the email connected to your student or staff profile."
                : "Your matric or staff ID identifies your campus profile."}
            </p>
          </div>
          <form className="space-y-4" onSubmit={submit}>
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-2">
                <ChoiceButton
                  active={accountType === "student"}
                  onClick={() => setAccountType("student")}
                  label="Student"
                />
                <ChoiceButton
                  active={accountType === "staff"}
                  onClick={() => setAccountType("staff")}
                  label="Staff"
                />
              </div>
            )}
            {mode === "signup" && (
              <Field
                label={accountType === "student" ? "Matric number" : "Staff ID"}
                value={form.identifier}
                onChange={(value) => update("identifier", value)}
                placeholder={accountType === "student" ? "e.g. 22CS0417" : "e.g. GSU-STAFF-014"}
              />
            )}
            {mode === "signup" && (
              <Field
                label="Full name"
                value={form.displayName}
                onChange={(value) => update("displayName", value)}
                placeholder="Your name"
              />
            )}
            <Field
              label="Email address"
              type="email"
              value={form.email}
              onChange={(value) => update("email", value)}
              placeholder="you@example.com"
            />
            <Field
              label="Password"
              type="password"
              value={form.password}
              onChange={(value) => update("password", value)}
              placeholder="At least 6 characters"
            />
            {mode === "signup" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Faculty"
                  value={form.faculty}
                  options={faculties}
                  onChange={(value) => update("faculty", value)}
                />
                <SelectField
                  label="Department"
                  value={form.department}
                  options={departments}
                  onChange={(value) => update("department", value)}
                />
              </div>
            )}
            {error && (
              <p className="rounded-xl bg-secondary px-3 py-2.5 text-sm text-secondary-foreground">
                {error}
              </p>
            )}
            <Button disabled={busy} className="h-11 w-full rounded-xl">
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "New to the recovery desk?" : "Already have an account?"}{" "}
            <button
              className="font-semibold text-primary hover:underline"
              onClick={() => {
                setError("");
                onModeChange(mode === "login" ? "signup" : "login");
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeFeed({
  userId,
  mode,
  onModeChange,
  onReport,
  refreshKey,
  onClaim,
}: {
  userId: string;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onReport: () => void;
  refreshKey: number;
  onClaim: () => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  return (
    <>
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Campus item board
            </p>
            <h2 className="mt-1 font-display text-xl font-bold">Find what matters</h2>
          </div>
          <Button
            variant="ghost"
            className="justify-start rounded-xl text-primary sm:justify-center"
            onClick={onReport}
          >
            <Plus className="size-4" />
            Add a report
          </Button>
        </div>
        <div className="mt-5 flex gap-2 rounded-xl bg-secondary p-1">
          <button
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "lost" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}
            onClick={() => onModeChange("lost")}
          >
            Lost items
          </button>
          <button
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "found" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}
            onClick={() => onModeChange("found")}
          >
            Found items
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="field pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search item, location, or description"
            />
          </label>
          <select
            className="field sm:w-44"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option value={item} key={item}>
                {labelFor(item)}
              </option>
            ))}
          </select>
        </div>
      </section>
      <ItemFeed
        userId={userId}
        mode={mode}
        search={search}
        category={category}
        refreshKey={refreshKey}
        onClaim={onClaim}
      />
    </>
  );
}

function ItemBrowse({
  mode,
  onModeChange,
  refreshKey,
}: {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  refreshKey: number;
}) {
  return (
    <>
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Browse reports
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold">Campus item board</h2>
      </div>
      <div className="mb-5 flex gap-2 rounded-xl bg-secondary p-1">
        <button
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === "lost" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}
          onClick={() => onModeChange("lost")}
        >
          Lost items
        </button>
        <button
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === "found" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}
          onClick={() => onModeChange("found")}
        >
          Found items
        </button>
      </div>
      <ItemFeed mode={mode} search="" category="all" refreshKey={refreshKey} />
    </>
  );
}

function ItemFeed({
  userId,
  mode,
  search,
  category,
  refreshKey,
  onClaim,
}: {
  userId?: string;
  mode: Mode;
  search: string;
  category: string;
  refreshKey: number;
  onClaim?: () => void;
}) {
  const [items, setItems] = useState<Array<LostItem | FoundItem>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const table = mode === "lost" ? "lost_items" : "found_items";
      const { data } = await supabase
        .from(table)
        .select("*")
        .neq("status", "closed")
        .order("created_at", { ascending: false })
        .limit(30);
      setItems((data ?? []) as Array<LostItem | FoundItem>);
      setLoading(false);
    };
    void load();
  }, [mode, refreshKey]);
  const visible = useMemo(
    () =>
      items.filter((item) => {
        const haystack = `${item.item_name} ${item.location} ${item.description}`.toLowerCase();
        return (
          (!search || haystack.includes(search.toLowerCase())) &&
          (category === "all" || item.category === category)
        );
      }),
    [items, search, category],
  );
  if (loading)
    return (
      <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Loading item reports…
      </div>
    );
  if (!visible.length)
    return (
      <div className="mt-6">
        <EmptyState
          icon={<Package />}
          title={`No ${mode} reports yet`}
          detail="When a report is added, it will appear here for the campus community."
        />
      </div>
    );
  return (
    <div className="mt-6 space-y-3">
      {visible.map((item) => (
        <ItemCard key={item.id} item={item} userId={userId} onClaim={onClaim} />
      ))}
    </div>
  );
}

function ItemCard({
  item,
  userId,
  onClaim,
}: {
  item: LostItem | FoundItem;
  userId?: string;
  onClaim?: () => void;
}) {
  const isFound = "date_found" in item;
  const [claiming, setClaiming] = useState(false);
  const claim = async () => {
    if (!isFound || !userId) return;
    setClaiming(true);
    const { error } = await supabase
      .from("claims")
      .insert({
        claimant_id: userId,
        found_item_id: item.id,
        message: `I believe this ${item.item_name} belongs to me.`,
      });
    setClaiming(false);
    if (!error) onClaim?.();
  };
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
          <ItemIcon category={item.category} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${isFound ? "bg-emerald-500/10 text-emerald-700" : "bg-primary/10 text-primary"}`}
            >
              {isFound ? "Found" : "Lost"}
            </span>
            <span className="text-xs text-muted-foreground">{labelFor(item.category)}</span>
          </div>
          <h3 className="mt-2 font-display text-base font-bold">{item.item_name}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
            {item.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {item.location}
            </span>
            <span>{formatDate(isFound ? item.date_found : item.date_lost)}</span>
            {isFound && <span>Kept at {item.kept_at}</span>}
          </div>
        </div>
      </div>
      {isFound && (
        <Button
          className="mt-4 w-full rounded-xl"
          variant="outline"
          disabled={claiming}
          onClick={claim}
        >
          {claiming ? "Sending…" : "This is mine"}
        </Button>
      )}
    </article>
  );
}

function MatchesView({
  userId,
  refreshKey,
  onClaim,
}: {
  userId: string;
  refreshKey: number;
  onClaim: () => void;
}) {
  const [matches, setMatches] = useState<Array<Match & { found?: FoundItem; lost?: LostItem }>>([]);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("matches")
        .select("*, found_items(*), lost_items(*)")
        .order("match_score", { ascending: false })
        .limit(20);
      setMatches(
        (data ?? []).map((row) => ({
          ...row,
          found: row.found_items as unknown as FoundItem,
          lost: row.lost_items as unknown as LostItem,
        })),
      );
    };
    void load();
  }, [userId, refreshKey]);
  return (
    <>
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Matching engine
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold">Possible matches</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Reports are compared by item name, category, location, and nearby dates.
        </p>
      </div>
      {!matches.length ? (
        <EmptyState
          icon={<TicketCheck />}
          title="No possible matches yet"
          detail="Add a lost or found report and matching results will appear here."
        />
      ) : (
        <div className="space-y-3">
          {matches.map((match) => (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4" key={match.id}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                  {match.match_score}% match
                </span>
                <span className="text-xs text-muted-foreground">{match.match_reason}</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MiniMatch item={match.lost} label="Lost report" />
                <MiniMatch item={match.found} label="Found report" />
              </div>
              {match.found && (
                <Button className="mt-4 w-full rounded-xl" onClick={onClaim}>
                  This is mine
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function AdminView({
  refreshKey,
  onNotice,
}: {
  refreshKey: number;
  onNotice: (notice: string) => void;
}) {
  const [claims, setClaims] = useState<Array<Claim & { found?: FoundItem }>>([]);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("claims")
        .select("*, found_items(*)")
        .order("created_at", { ascending: false });
      setClaims(
        (data ?? []).map((row) => ({ ...row, found: row.found_items as unknown as FoundItem })),
      );
    };
    void load();
  }, [refreshKey]);
  const review = async (claim: Claim, status: "approved" | "rejected") => {
    const { data: auth } = await supabase.auth.getUser();
    await supabase
      .from("claims")
      .update({ status, reviewed_by: auth.user?.id, reviewed_at: new Date().toISOString() })
      .eq("id", claim.id);
    if (status === "approved")
      await supabase
        .from("found_items")
        .update({ status: "claimed" })
        .eq("id", claim.found_item_id);
    onNotice(
      status === "approved" ? "Claim approved and item marked as claimed." : "Claim rejected.",
    );
  };
  return (
    <>
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          SUG / Security Admin
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold">Claim review queue</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Verify claims, approve ownership, and move returned items through recovery.
        </p>
      </div>
      {!claims.length ? (
        <EmptyState
          icon={<ShieldCheck />}
          title="No claims need review"
          detail="New ownership requests will appear here."
        />
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm" key={claim.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{claim.found?.item_name ?? "Found item"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Claim submitted {formatDate(claim.created_at)}
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {claim.status}
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{claim.message}</p>
              {claim.status === "pending" && (
                <div className="mt-4 flex gap-2">
                  <Button
                    className="flex-1 rounded-xl"
                    onClick={() => void review(claim, "approved")}
                  >
                    <Check className="size-4" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => void review(claim, "rejected")}
                  >
                    <X className="size-4" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ReportDialog({
  mode,
  userId,
  onClose,
  onSaved,
}: {
  mode: Mode;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    itemName: "",
    category: categories[0],
    description: "",
    location: locations[0],
    date: new Date().toISOString().slice(0, 10),
    keptAt: keptAt[0],
    file: null as File | null,
  });
  const update = (key: keyof typeof form, value: string | File | null) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    let imagePath: string | null = null;
    if (form.file) {
      const extension = form.file.name.split(".").pop() ?? "jpg";
      imagePath = `${userId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("item-images")
        .upload(imagePath, form.file);
      if (uploadError) {
        setError(uploadError.message);
        setBusy(false);
        return;
      }
    }
    const payload =
      mode === "lost"
        ? {
            reporter_id: userId,
            item_name: form.itemName,
            category: form.category,
            description: form.description,
            location: form.location,
            date_lost: form.date,
            image_path: imagePath,
          }
        : {
            reporter_id: userId,
            item_name: form.itemName,
            category: form.category,
            description: form.description,
            location: form.location,
            date_found: form.date,
            kept_at: form.keptAt,
            image_path: imagePath,
          };
    const { error: saveError } = await supabase
      .from(mode === "lost" ? "lost_items" : "found_items")
      .insert(payload);
    if (saveError) setError(saveError.message);
    else onSaved();
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/30 p-4 backdrop-blur-sm">
      <div className="mx-auto my-8 max-w-2xl rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              New report
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold">
              Report {mode === "lost" ? "a lost" : "a found"} item
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Give enough detail for the matching engine and recovery desk.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close report">
            <X className="size-5" />
          </Button>
        </div>
        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <div className="sm:col-span-2">
            <Field
              label="Item name"
              value={form.itemName}
              onChange={(value) => update("itemName", value)}
              placeholder="e.g. Black laptop bag"
            />
          </div>
          <SelectField
            label="Category"
            value={form.category}
            options={categories}
            onChange={(value) => update("category", value)}
          />
          <SelectField
            label="Location"
            value={form.location}
            options={locations}
            onChange={(value) => update("location", value)}
          />
          <Field
            label={mode === "lost" ? "Date lost" : "Date found"}
            type="date"
            value={form.date}
            onChange={(value) => update("date", value)}
          />
          {mode === "found" && (
            <SelectField
              label="Kept at"
              value={form.keptAt}
              options={keptAt}
              onChange={(value) => update("keptAt", value)}
            />
          )}
          <div className="sm:col-span-2">
            <label className="label">
              Description
              <textarea
                className="field mt-1 min-h-28 resize-y"
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                placeholder="Colour, marks, contents, identifying details…"
                required
              />
            </label>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground sm:col-span-2">
            <ImagePlus className="size-5 text-primary" />
            <span className="flex-1">{form.file?.name ?? "Add an item photo (optional)"}</span>
            <input
              className="sr-only"
              type="file"
              accept="image/*"
              onChange={(event) => update("file", event.target.files?.[0] ?? null)}
            />
          </label>
          {error && (
            <p className="sm:col-span-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" className="rounded-xl" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={busy} className="rounded-xl">
              {busy ? "Saving…" : "Submit report"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div
        className={`grid size-9 place-items-center rounded-xl ${tone === "blue" ? "bg-primary/10 text-primary" : tone === "green" ? "bg-emerald-500/10 text-emerald-700" : tone === "orange" ? "bg-amber-500/10 text-amber-700" : "bg-violet-500/10 text-violet-700"}`}
      >
        {icon}
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
function ProfileCard({ profile }: { profile: Profile | null }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
          <UserRound className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{profile?.display_name}</p>
          <p className="truncate text-xs text-muted-foreground">{profile?.identifier}</p>
        </div>
      </div>
      <div className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Faculty</span>
          <span className="text-right font-medium">{profile?.faculty}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Department</span>
          <span className="text-right font-medium">{profile?.department}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Status</span>
          <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
            <ShieldCheck className="size-3.5" />
            {profile?.is_verified ? "Verified" : "Pending verification"}
          </span>
        </div>
      </div>
    </div>
  );
}
function MiniMatch({ item, label }: { item?: LostItem | FoundItem; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-semibold">{item?.item_name ?? "Report"}</p>
      <p className="mt-1 text-xs text-muted-foreground">{item?.location ?? "Campus location"}</p>
    </div>
  );
}
function EmptyState({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  );
}
function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition lg:flex-row lg:gap-2 ${active ? "text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
function ChoiceButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="label">
      {label}
      <input
        className="field mt-1"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
      />
    </label>
  );
}
function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="label">
      {label}
      <span className="relative mt-1 block">
        <select
          className="field appearance-none pr-9"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {labelFor(option)}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </span>
    </label>
  );
}
function ItemIcon({ category }: { category: string }) {
  if (category === "electronics") return <Laptop className="size-6" />;
  if (category === "accessories") return <Smartphone className="size-6" />;
  if (category === "books") return <BookOpen className="size-6" />;
  return <Package className="size-6" />;
}
function labelFor(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
