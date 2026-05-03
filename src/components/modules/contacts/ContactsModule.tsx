"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCircle2,
  Users as UsersIcon,
} from "lucide-react";
import { canEdit, useRole } from "@/lib/role-context";
import type { ModuleProps } from "@/components/dashboard/modules";
import {
  createCompany,
  createContact,
  deleteCompany,
  deleteContact,
  ensureCompanyCategories,
  fetchActivityForContact,
  fetchContacts,
  isCategoryColumnMissing,
  updateCompany,
  updateContact,
  type ActivityRow,
} from "./queries";
import {
  COMPANY_CATEGORIES,
  COMPANY_CATEGORY_LABEL,
  ROLE_TYPES,
  ROLE_TYPE_LABEL,
  ROLE_TYPE_STYLE,
  contactDisplayName,
  type Company,
  type CompanyCategory,
  type CompanyPatch,
  type Contact,
  type ContactPatch,
  type RoleType,
} from "./types";

type Selection =
  | { kind: "contact"; id: string }
  | { kind: "company"; id: string }
  | null;

export function ContactsModule({ projectId }: ModuleProps) {
  const role = useRole();
  const editable = canEdit(role);
  const apmCanAdd = role === "apm"; // APM view-only with add ability per spec
  const canCreate = editable || apmCanAdd;

  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryMissing, setCategoryMissing] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleType | "all">("all");
  const [selection, setSelection] = useState<Selection>(null);
  // Track which category sections are collapsed. Default all expanded.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Map a contact's role_type to a company category bucket so new contacts
  // land in the right section automatically.
  function categoryForRole(role: RoleType | null): CompanyCategory | null {
    switch (role) {
      case "client":
        return "client";
      case "architect":
        return "design_team";
      case "subcontractor":
        return "subs_trade";
      case "mep":
        return "subs_mep";
      case "inspector":
        return "permits_inspections";
      case "supplier":
        return "vendors";
      case "owner":
      case "pm":
      case "apm":
      case "super":
      case "general_contractor":
        return "bcm_team";
      default:
        return null;
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [cos, cts] = await Promise.all([
          ensureCompanyCategories(projectId),
          fetchContacts(projectId),
        ]);
        if (cancelled) return;
        setCompanies(cos);
        setContacts(cts);
        setCategoryMissing(isCategoryColumnMissing());
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load contacts",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (roleFilter !== "all" && c.role_type !== roleFilter) return false;
      if (!q) return true;
      const haystack = [
        c.first_name,
        c.last_name,
        c.email ?? "",
        c.phone ?? "",
        ROLE_TYPE_LABEL[c.role_type as RoleType] ?? "",
        companies.find((co) => co.id === c.company_id)?.company_name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [contacts, companies, search, roleFilter]);

  const groupedByCategory = useMemo(() => {
    // Build companies-with-contacts for each of the seven canonical categories,
    // plus an "Uncategorized" bucket for any legacy company without a category.
    const contactsByCompany = new Map<string, Contact[]>();
    const orphans: Contact[] = [];
    for (const c of filteredContacts) {
      if (c.company_id) {
        const list = contactsByCompany.get(c.company_id) ?? [];
        list.push(c);
        contactsByCompany.set(c.company_id, list);
      } else {
        orphans.push(c);
      }
    }
    const sections: Array<{
      key: string;
      label: string;
      category: CompanyCategory | null;
      companies: Array<{ company: Company; rows: Contact[] }>;
    }> = COMPANY_CATEGORIES.map((cat) => ({
      key: cat,
      label: COMPANY_CATEGORY_LABEL[cat],
      category: cat,
      companies: companies
        .filter((c) => c.category === cat)
        .map((co) => ({
          company: co,
          rows: contactsByCompany.get(co.id) ?? [],
        })),
    }));
    const uncategorizedCompanies = companies
      .filter((c) => !c.category)
      .map((co) => ({
        company: co,
        rows: contactsByCompany.get(co.id) ?? [],
      }));
    const showUncategorized =
      uncategorizedCompanies.length > 0 ||
      orphans.length > 0 ||
      categoryMissing;
    if (showUncategorized) {
      sections.push({
        key: "__uncategorized__",
        label: categoryMissing ? "All companies" : "Uncategorized",
        category: null,
        companies: uncategorizedCompanies,
      });
    }
    return { sections, orphans };
  }, [filteredContacts, companies, categoryMissing]);

  async function handleAddCompany(category: CompanyCategory | null = null) {
    const name = window.prompt(
      category
        ? `New company under ${COMPANY_CATEGORY_LABEL[category]}?`
        : "Company name?",
    );
    if (name === null) return;
    try {
      const created = await createCompany(
        projectId,
        name.trim(),
        category,
      );
      setCompanies((rows) =>
        [...rows, created].sort((a, b) =>
          a.company_name.localeCompare(b.company_name),
        ),
      );
      setSelection({ kind: "company", id: created.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add company");
    }
  }

  async function handleAddContact(companyId: string | null = null) {
    try {
      const created = await createContact(projectId, {
        company_id: companyId,
      });
      setContacts((rows) => [...rows, created]);
      setSelection({ kind: "contact", id: created.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add contact");
    }
  }

  // Toolbar "Add contact" — pick a role type, drop the new contact under
  // the first company in the matching category bucket. Surfaces them in
  // the right section immediately, no orphans.
  async function handleAddContactByRole() {
    const choices = ROLE_TYPES.map((r, i) => `${i + 1}. ${ROLE_TYPE_LABEL[r]}`).join(
      "\n",
    );
    const pick = window.prompt(
      `Pick a role for the new contact (1-${ROLE_TYPES.length}):\n\n${choices}`,
      "1",
    );
    if (!pick) return;
    const idx = parseInt(pick, 10) - 1;
    if (Number.isNaN(idx) || idx < 0 || idx >= ROLE_TYPES.length) {
      setError("Invalid role pick.");
      return;
    }
    const role = ROLE_TYPES[idx];
    const cat = categoryForRole(role);
    const companyForRole = cat
      ? companies.find((c) => c.category === cat)
      : null;
    try {
      const created = await createContact(projectId, {
        company_id: companyForRole?.id ?? null,
        role_type: role,
      });
      setContacts((rows) => [...rows, created]);
      setSelection({ kind: "contact", id: created.id });
      // Make sure that section is expanded so they see the new row.
      if (cat) {
        setCollapsed((prev) => {
          const next = new Set(prev);
          next.delete(cat);
          return next;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add contact");
    }
  }

  async function handleUpdateContact(id: string, patch: ContactPatch) {
    const prev = contacts;
    setContacts((rows) =>
      rows.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
    try {
      await updateContact(id, patch);
    } catch (err) {
      setContacts(prev);
      setError(err instanceof Error ? err.message : "Failed to save contact");
    }
  }

  async function handleDeleteContact(id: string) {
    if (!window.confirm("Delete this contact?")) return;
    const prev = contacts;
    setContacts((rows) => rows.filter((c) => c.id !== id));
    if (selection?.kind === "contact" && selection.id === id) setSelection(null);
    try {
      await deleteContact(id);
    } catch (err) {
      setContacts(prev);
      setError(err instanceof Error ? err.message : "Failed to delete contact");
    }
  }

  async function handleUpdateCompany(id: string, patch: CompanyPatch) {
    const prev = companies;
    setCompanies((rows) =>
      rows.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
    try {
      await updateCompany(id, patch);
    } catch (err) {
      setCompanies(prev);
      setError(err instanceof Error ? err.message : "Failed to save company");
    }
  }

  async function handleDeleteCompany(id: string) {
    const inUse = contacts.some((c) => c.company_id === id);
    if (inUse) {
      window.alert("Move or remove the contacts at this company first.");
      return;
    }
    if (!window.confirm("Delete this company?")) return;
    const prev = companies;
    setCompanies((rows) => rows.filter((c) => c.id !== id));
    if (selection?.kind === "company" && selection.id === id) setSelection(null);
    try {
      await deleteCompany(id);
    } catch (err) {
      setCompanies(prev);
      setError(err instanceof Error ? err.message : "Failed to delete company");
    }
  }

  const selectedContact =
    selection?.kind === "contact"
      ? contacts.find((c) => c.id === selection.id)
      : null;
  const selectedCompany =
    selection?.kind === "company"
      ? companies.find((c) => c.id === selection.id)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <UsersIcon className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">Contacts</h1>
      </div>

      {!editable && !apmCanAdd && (
        <p className="text-xs text-zinc-500">
          View only — your role ({role}) cannot edit contacts.
        </p>
      )}

      {categoryMissing && (
        <CategorySetupBanner />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone…"
            className="w-72 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 pl-8 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleType | "all")}
          className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
        >
          <option value="all">All roles</option>
          {ROLE_TYPES.map((r) => (
            <option key={r} value={r}>
              {ROLE_TYPE_LABEL[r]}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          {canCreate && (
            <>
              <button
                type="button"
                onClick={handleAddContactByRole}
                className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
              >
                <Plus className="h-3.5 w-3.5" />
                Add contact
              </button>
              <button
                type="button"
                onClick={() => handleAddCompany(null)}
                className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-blue-500 hover:text-blue-400"
              >
                <Plus className="h-3.5 w-3.5" />
                Add company
              </button>
            </>
          )}
        </div>
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {!loading && !error && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          {/* List pane */}
          <div className="flex flex-col gap-4">
            {(categoryMissing
              ? groupedByCategory.sections.filter(
                  (s) => s.key === "__uncategorized__",
                )
              : groupedByCategory.sections
            ).map((section) => {
              const isCollapsed = collapsed.has(section.key);
              const peopleCount = section.companies.reduce(
                (sum, { rows }) => sum + rows.length,
                0,
              );
              return (
              <div key={section.key} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(section.key)}
                    className="flex flex-1 items-center gap-2 rounded py-0.5 text-left transition hover:text-zinc-300"
                    aria-expanded={!isCollapsed}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                    )}
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      {section.label}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      {section.companies.length}{" "}
                      {section.companies.length === 1 ? "company" : "companies"}
                      {peopleCount > 0 && ` · ${peopleCount} people`}
                    </span>
                  </button>
                  {canCreate && section.category && (
                    <button
                      type="button"
                      onClick={() => handleAddCompany(section.category)}
                      className="rounded p-0.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-blue-400"
                      title={`Add company under ${section.label}`}
                      aria-label={`Add company under ${section.label}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {!isCollapsed &&
                  (section.companies.length === 0 ? (
                  <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/30 p-3 text-xs text-zinc-500">
                    {section.category
                      ? `Empty — click + to add the ${section.label.toLowerCase()} company.`
                      : "No companies yet — use Add company in the toolbar above."}
                  </div>
                ) : (
                  section.companies.map(({ company, rows }) => (
                    <div
                      key={company.id}
                      className="rounded-md border border-zinc-800 bg-zinc-900/40"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSelection({ kind: "company", id: company.id })
                        }
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-zinc-900 ${
                          selectedCompany?.id === company.id
                            ? "bg-zinc-900"
                            : ""
                        }`}
                      >
                        <Building2 className="h-4 w-4 text-zinc-500" />
                        <span className="text-sm font-medium text-zinc-200">
                          {company.company_name?.trim() || (
                            <span className="italic text-zinc-500">
                              Click to fill in name…
                            </span>
                          )}
                        </span>
                        <span className="ml-auto text-xs text-zinc-500">
                          {rows.length}
                        </span>
                      </button>
                      {rows.length > 0 && (
                        <ul className="divide-y divide-zinc-800/60 border-t border-zinc-800/60">
                          {rows.map((c) => {
                            const active =
                              selectedContact?.id === c.id &&
                              selection?.kind === "contact";
                            return (
                              <li key={c.id}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelection({ kind: "contact", id: c.id })
                                  }
                                  className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                                    active
                                      ? "bg-blue-600/10 text-blue-300"
                                      : "text-zinc-300 hover:bg-zinc-900"
                                  }`}
                                >
                                  <UserCircle2 className="h-4 w-4 shrink-0 text-zinc-500" />
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm">
                                      {contactDisplayName(c)}
                                    </div>
                                    {c.email && (
                                      <div className="truncate text-[11px] text-zinc-500">
                                        {c.email}
                                      </div>
                                    )}
                                  </div>
                                  {c.role_type && (
                                    <RoleBadge role={c.role_type as RoleType} />
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ))
                ))}
              </div>
              );
            })}
            {groupedByCategory.orphans.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Unaffiliated contacts
                </div>
                <ul className="divide-y divide-zinc-800/60 rounded-md border border-zinc-800 bg-zinc-900/40">
                  {groupedByCategory.orphans.map((c) => {
                    const active =
                      selectedContact?.id === c.id &&
                      selection?.kind === "contact";
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setSelection({ kind: "contact", id: c.id })
                          }
                          className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                            active
                              ? "bg-blue-600/10 text-blue-300"
                              : "text-zinc-300 hover:bg-zinc-900"
                          }`}
                        >
                          <UserCircle2 className="h-4 w-4 shrink-0 text-zinc-500" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm">
                              {contactDisplayName(c)}
                            </div>
                            {c.email && (
                              <div className="truncate text-[11px] text-zinc-500">
                                {c.email}
                              </div>
                            )}
                          </div>
                          {c.role_type && (
                            <RoleBadge role={c.role_type as RoleType} />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Detail pane */}
          <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
            {!selection && (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center text-sm text-zinc-500">
                <UserCircle2 className="h-8 w-8 text-zinc-700" />
                <p>Select a contact or company.</p>
              </div>
            )}

            {selectedContact && (
              <ContactDetail
                projectId={projectId}
                contact={selectedContact}
                companies={companies}
                editable={editable}
                onUpdate={handleUpdateContact}
                onDelete={handleDeleteContact}
              />
            )}

            {selectedCompany && (
              <CompanyDetail
                company={selectedCompany}
                contacts={contacts.filter(
                  (c) => c.company_id === selectedCompany.id,
                )}
                editable={editable}
                onUpdate={handleUpdateCompany}
                onDelete={handleDeleteCompany}
                onAddContactHere={() => handleAddContact(selectedCompany.id)}
                onSelectContact={(id) =>
                  setSelection({ kind: "contact", id })
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ContactDetail({
  projectId,
  contact,
  companies,
  editable,
  onUpdate,
  onDelete,
}: {
  projectId: string;
  contact: Contact;
  companies: Company[];
  editable: boolean;
  onUpdate: (id: string, patch: ContactPatch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setActivityLoading(true);
    fetchActivityForContact(projectId, contact.email)
      .then((rows) => {
        if (!cancelled) setActivity(rows);
      })
      .catch(() => {
        if (!cancelled) setActivity([]);
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, contact.id, contact.email]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">
            <UserCircle2 className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-semibold text-zinc-100">
              {contactDisplayName(contact)}
            </div>
            <div className="text-xs text-zinc-500">
              {contact.role_type
                ? ROLE_TYPE_LABEL[contact.role_type as RoleType]
                : "No role"}
            </div>
          </div>
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => onDelete(contact.id)}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
            aria-label="Delete contact"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 border-y border-zinc-800 py-3">
        <a
          href={contact.email ? `mailto:${contact.email}` : undefined}
          aria-disabled={!contact.email}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs ${
            contact.email
              ? "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-blue-500 hover:text-blue-400"
              : "pointer-events-none border-zinc-800 bg-zinc-950 text-zinc-600"
          }`}
        >
          <Mail className="h-3.5 w-3.5" />
          Send message
        </a>
        <QuickActionStub label="Create RFI" />
        <QuickActionStub label="Generate document" />
        <QuickActionStub label="View all tasks" />
      </div>

      {/* Fields */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name">
          <Input
            value={contact.first_name}
            editable={editable}
            onCommit={(v) => onUpdate(contact.id, { first_name: v })}
          />
        </Field>
        <Field label="Last name">
          <Input
            value={contact.last_name}
            editable={editable}
            onCommit={(v) => onUpdate(contact.id, { last_name: v })}
          />
        </Field>
        <Field label="Company">
          <select
            value={contact.company_id ?? ""}
            disabled={!editable}
            onChange={(e) =>
              onUpdate(contact.id, {
                company_id: e.target.value === "" ? null : e.target.value,
              })
            }
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
          >
            <option value="">— Unaffiliated —</option>
            {companies.map((co) => (
              <option key={co.id} value={co.id}>
                {co.company_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Role type">
          <select
            value={contact.role_type ?? ""}
            disabled={!editable}
            onChange={(e) =>
              onUpdate(contact.id, {
                role_type: e.target.value === ""
                  ? null
                  : (e.target.value as RoleType),
              })
            }
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
          >
            <option value="">— None —</option>
            {ROLE_TYPES.map((r) => (
              <option key={r} value={r}>
                {ROLE_TYPE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Email">
          <Input
            value={contact.email ?? ""}
            editable={editable}
            type="email"
            onCommit={(v) => onUpdate(contact.id, { email: v || null })}
          />
        </Field>
        <Field label="Phone">
          <Input
            value={contact.phone ?? ""}
            editable={editable}
            type="tel"
            onCommit={(v) => onUpdate(contact.id, { phone: v || null })}
          />
        </Field>
        <Field label="Address" wide>
          <Input
            value={contact.address ?? ""}
            editable={editable}
            onCommit={(v) => onUpdate(contact.id, { address: v || null })}
          />
        </Field>
      </div>

      <Field label="Notes" wide>
        <textarea
          defaultValue={contact.notes ?? ""}
          disabled={!editable}
          rows={3}
          onBlur={(e) => {
            const v = e.target.value;
            const current = contact.notes ?? "";
            if (v !== current)
              onUpdate(contact.id, { notes: v || null });
          }}
          className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
        />
      </Field>

      {/* Activity feed */}
      <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4">
        <h3 className="text-sm font-medium text-zinc-200">Activity</h3>
        {!contact.email && (
          <p className="text-xs text-zinc-500">
            Add an email to see related messages.
          </p>
        )}
        {activityLoading && (
          <p className="text-xs text-zinc-500">Loading activity…</p>
        )}
        {!activityLoading && activity.length === 0 && contact.email && (
          <p className="text-xs text-zinc-500">No related messages yet.</p>
        )}
        <ul className="flex flex-col gap-1.5">
          {activity.map((row) => (
            <li
              key={row.id}
              className="rounded-md border border-zinc-800 bg-zinc-950/50 p-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-blue-300">
                  Message
                </span>
                <span className="text-zinc-500">
                  {new Date(row.ts).toLocaleString()}
                </span>
              </div>
              <div className="mt-1 truncate text-zinc-200">{row.label}</div>
              {row.detail && (
                <div className="mt-0.5 line-clamp-2 text-zinc-500">
                  {row.detail}
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[11px] text-zinc-600">
          RFIs, documents, requisitions, and tasks will appear here once those
          modules are wired to contacts.
        </p>
      </div>
    </div>
  );
}

function CompanyDetail({
  company,
  contacts,
  editable,
  onUpdate,
  onDelete,
  onAddContactHere,
  onSelectContact,
}: {
  company: Company;
  contacts: Contact[];
  editable: boolean;
  onUpdate: (id: string, patch: CompanyPatch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddContactHere: () => Promise<void>;
  onSelectContact: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-800 text-zinc-300">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-semibold text-zinc-100">
              {company.company_name}
            </div>
            <div className="text-xs text-zinc-500">
              {contacts.length} contact{contacts.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(company.category === "subs_trade" ||
            company.category === "subs_mep") && (
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("bcm-navigate", {
                    detail: { moduleKey: "subs", subName: company.company_name },
                  }),
                );
              }}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-400"
              title="Open profile in Subs module"
            >
              Open in Subs
            </button>
          )}
          {editable && (
            <button
              type="button"
              onClick={() => onDelete(company.id)}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
              aria-label="Delete company"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company name" wide>
          <Input
            value={company.company_name}
            editable={editable}
            onCommit={(v) =>
              onUpdate(company.id, { company_name: v || "Unnamed" })
            }
          />
        </Field>
        <Field label="Address">
          <Input
            value={company.address ?? ""}
            editable={editable}
            onCommit={(v) => onUpdate(company.id, { address: v || null })}
          />
        </Field>
        <Field label="Phone">
          <Input
            value={company.phone ?? ""}
            editable={editable}
            type="tel"
            onCommit={(v) => onUpdate(company.id, { phone: v || null })}
          />
        </Field>
        <Field label="Website" wide>
          <Input
            value={company.website ?? ""}
            editable={editable}
            type="url"
            onCommit={(v) => onUpdate(company.id, { website: v || null })}
          />
        </Field>
        <Field label="Primary contact" wide>
          <select
            value={company.primary_contact_id ?? ""}
            disabled={!editable}
            onChange={(e) =>
              onUpdate(company.id, {
                primary_contact_id:
                  e.target.value === "" ? null : e.target.value,
              })
            }
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
          >
            <option value="">— None —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {contactDisplayName(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category" wide>
          <select
            value={company.category ?? ""}
            disabled={!editable}
            onChange={(e) =>
              onUpdate(company.id, {
                category: (e.target.value || null) as CompanyCategory | null,
              })
            }
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60 [color-scheme:dark]"
          >
            <option value="">— Uncategorized —</option>
            {COMPANY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {COMPANY_CATEGORY_LABEL[cat]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
        <h3 className="text-sm font-medium text-zinc-200">People</h3>
        {editable && (
          <button
            type="button"
            onClick={onAddContactHere}
            className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-400"
          >
            <Plus className="h-3 w-3" />
            Add contact
          </button>
        )}
      </div>
      {contacts.length === 0 ? (
        <p className="text-xs text-zinc-500">No contacts at this company yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-800/60 rounded-md border border-zinc-800">
          {contacts.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelectContact(c.id)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-zinc-900"
              >
                <UserCircle2 className="h-4 w-4 text-zinc-500" />
                <span className="flex-1 text-sm text-zinc-200">
                  {contactDisplayName(c)}
                </span>
                {c.email && (
                  <span className="hidden text-xs text-zinc-500 sm:inline-flex">
                    <Mail className="mr-1 h-3 w-3" />
                    {c.email}
                  </span>
                )}
                {c.phone && (
                  <span className="hidden text-xs text-zinc-500 md:inline-flex">
                    <Phone className="mr-1 h-3 w-3" />
                    {c.phone}
                  </span>
                )}
                {c.role_type && (
                  <RoleBadge role={c.role_type as RoleType} />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: RoleType }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${ROLE_TYPE_STYLE[role]}`}
    >
      {ROLE_TYPE_LABEL[role]}
    </span>
  );
}

function QuickActionStub({ label }: { label: string }) {
  return (
    <button
      type="button"
      title="Coming soon"
      className="cursor-not-allowed rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-500"
    >
      {label}
    </button>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`flex flex-col gap-1 text-[11px] uppercase tracking-wider text-zinc-500 ${
        wide ? "sm:col-span-2" : ""
      }`}
    >
      {label}
      <div className="text-sm normal-case tracking-normal text-zinc-200">
        {children}
      </div>
    </label>
  );
}

function Input({
  value,
  editable,
  type = "text",
  onCommit,
}: {
  value: string;
  editable: boolean;
  type?: "text" | "email" | "tel" | "url";
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (!editable) {
    return (
      <span className="block min-h-[1.5rem] text-zinc-200">
        {value || <span className="text-zinc-500">—</span>}
      </span>
    );
  }

  return (
    <input
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
    />
  );
}

const CATEGORY_MIGRATION_SQL = `-- BCM Dashboard: enable Contacts category buckets
alter table companies add column if not exists category text;
create index if not exists companies_category_idx on companies (project_id, category);`;

function CategorySetupBanner() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(CATEGORY_MIGRATION_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this SQL", CATEGORY_MIGRATION_SQL);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
      <span className="flex-1 min-w-[260px]">
        Category buckets are off until you run the schema migration in
        Supabase. The flat list below works in the meantime.
      </span>
      <button
        type="button"
        onClick={copy}
        className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-500/20"
      >
        {copied ? "Copied — paste in Supabase SQL" : "Copy migration SQL"}
      </button>
    </div>
  );
}
