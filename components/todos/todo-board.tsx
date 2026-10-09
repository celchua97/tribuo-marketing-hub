'use client'

import { useEffect, useRef, useState } from 'react'
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  addSection,
  addTodo,
  deleteSection,
  deleteTodo,
  editSection,
  editTodo,
  moveTodo,
  setTodoDone,
  type TodoInput,
} from '@/app/(app)/todos/actions'
import { agoLabel, dueState, formatDate } from '@/lib/dates'
import type { TodoItem, TodoSection } from '@/lib/todos'

export type Person = { id: string; full_name: string }
type Row = {
  id: string
  title: string
  notes: string | null
  assigneeId: string | null
  dueOn: string | null
  link: string | null
  doneBy: string | null
  doneAt: string | null
}
type Data = { open: Record<string, Row[]>; done: Record<string, Row[]> }

function build(sections: TodoSection[], items: TodoItem[]): Data {
  const open: Data['open'] = {}
  const done: Data['done'] = {}
  for (const s of sections) {
    open[s.id] = []
    done[s.id] = []
  }
  for (const i of items) {
    const row: Row = {
      id: i.id,
      title: i.title,
      notes: i.notes,
      assigneeId: i.assignee_id,
      dueOn: i.due_on,
      link: i.source_link,
      doneBy: i.done_by_profile?.full_name ?? null,
      doneAt: i.done_at,
    }
    if (!open[i.section_id]) continue
    ;(i.done ? done : open)[i.section_id].push(row)
  }
  for (const s of sections) done[s.id].sort((a, b) => Date.parse(b.doneAt ?? '0') - Date.parse(a.doneAt ?? '0'))
  return { open, done }
}


const Grip = () => (
  <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="currentColor">
    <circle cx="9" cy="6" r="1.6" />
    <circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" />
    <circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" />
    <circle cx="15" cy="18" r="1.6" />
  </svg>
)

const NotesIcon = () => (
  <svg aria-label="Has notes" role="img" viewBox="0 0 24 24" className="size-4 shrink-0 text-grey" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M5 6h14M5 12h14M5 18h9" />
  </svg>
)

// Basecamp's little progress circle: empty, part-filled or filled with a tick
function Progress({ done, total }: { done: number; total: number }) {
  const full = total > 0 && done === total
  const part = done > 0 && !full
  return (
    <svg aria-hidden viewBox="0 0 28 28" className="size-7 shrink-0 text-blue">
      <circle cx="14" cy="14" r="12" fill={full ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" />
      {part && <path d={`M14 14 L14 4 A10 10 0 ${done / total > 0.5 ? 1 : 0} 1 ${14 + 10 * Math.sin((2 * Math.PI * done) / total)} ${14 - 10 * Math.cos((2 * Math.PI * done) / total)} Z`} fill="currentColor" />}
      {full && <path d="M8.5 14.5l4 4 7-8" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}

function shortName(full: string) {
  const parts = full.trim().split(/\s+/)
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0]
}

function Assignee({ name }: { name: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sand py-0.5 pr-2.5 pl-0.5 text-xs font-bold">
      <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-coral text-[10px] font-extrabold text-ink">
        {name.trim()[0]?.toUpperCase()}
      </span>
      {shortName(name)}
    </span>
  )
}

function DueChip({ dueOn, timeZone }: { dueOn: string; timeZone: string }) {
  const s = dueState(dueOn, timeZone)
  const cls = s === 'overdue' ? 'tag-salmon' : s === 'today' ? 'tag-yellow' : 'tag-cream'
  return <span className={`tag ${cls} shrink-0`}>{s === 'today' ? 'Today' : formatDate(dueOn)}</span>
}

// ---------------------------------------------------------------------------
// The form for adding or editing one to-do (Basecamp's inline card)
// ---------------------------------------------------------------------------
function TodoForm({
  initial,
  people,
  submitLabel,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Row
  people: Person[]
  submitLabel: string
  onSave: (input: TodoInput) => Promise<string | undefined>
  onCancel: () => void
  onDelete?: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [assignee, setAssignee] = useState(initial?.assigneeId ?? '')
  const [due, setDue] = useState(initial?.dueOn ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [confirm, setConfirm] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    const msg = await onSave({ title, notes, assigneeId: assignee || null, dueOn: due || null })
    setBusy(false)
    if (msg) setErr(msg)
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-[18px] border-2 border-beige bg-white p-4" aria-label={initial ? 'Edit to-do' : 'New to-do'}>
      <input
        autoFocus
        aria-label="To-do title"
        className="field"
        placeholder="Describe the to-do"
        maxLength={200}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        aria-label="Notes"
        className="field min-h-20"
        placeholder="Add extra details or attach a link"
        maxLength={2000}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="label">Assign to</span>
          <select aria-label="Assign to" className="field" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Nobody yet</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="label">Due on</span>
          <input aria-label="Due on" type="date" className="field" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
      </div>
      {err && (
        <p role="alert" className="text-sm font-bold text-danger">
          {err}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button className="chip chip-on" disabled={busy || !title.trim()}>
          {submitLabel}
        </button>
        <button type="button" className="chip" onClick={onCancel}>
          Cancel
        </button>
        {onDelete &&
          (confirm ? (
            <button type="button" className="chip ml-auto" onClick={onDelete} autoFocus>
              Yes, delete it
            </button>
          ) : (
            <button type="button" className="ml-auto text-sm font-bold text-grey underline" onClick={() => setConfirm(true)}>
              Delete
            </button>
          ))}
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// One to-do row
// ---------------------------------------------------------------------------
function RowBody({
  row,
  people,
  timeZone,
  onTick,
  onSave,
  onDelete,
  handle,
}: {
  row: Row
  people: Person[]
  timeZone: string
  onTick: () => void
  onSave: (input: TodoInput) => Promise<string | undefined>
  onDelete: () => void
  handle?: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const who = people.find((p) => p.id === row.assigneeId)

  if (editing) {
    return (
      <div className="py-2">
        <TodoForm
          initial={row}
          people={people}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onDelete={onDelete}
          onSave={async (i) => {
            const msg = await onSave(i)
            if (!msg) setEditing(false)
            return msg
          }}
        />
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-1.5 border-b border-beige py-2">
      {handle}
      <input
        type="checkbox"
        aria-label={`Done: ${row.title}`}
        checked={false}
        onChange={onTick}
        className="size-5 shrink-0 accent-[#3750ab]"
      />
      <button type="button" onClick={() => setEditing(true)} className="min-w-0 flex-1 px-1 py-1 text-left" title="Tap to edit">
        {row.title}
      </button>
      {row.notes && <NotesIcon />}
      {row.link && (
        <a href={row.link} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-bold text-blue">
          Slides ↗
        </a>
      )}
      {who && <Assignee name={who.full_name} />}
      {row.dueOn && <DueChip dueOn={row.dueOn} timeZone={timeZone} />}
    </div>
  )
}

function SortableRow(props: Omit<Parameters<typeof RowBody>[0], 'handle'> & { locked: boolean }) {
  const { locked, ...rest } = props
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.row.id,
    disabled: locked,
  })
  return (
    <div
      ref={setNodeRef}
      data-todo={props.row.title}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
    >
      <RowBody
        {...rest}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            aria-label={`Drag ${props.row.title}`}
            disabled={locked}
            className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-grey/60 hover:bg-sand hover:text-grey active:cursor-grabbing disabled:opacity-30"
            {...attributes}
            {...listeners}
          >
            <Grip />
          </button>
        }
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// One list: header, to-dos (a drop area), "Add a to-do", completed
// ---------------------------------------------------------------------------
function ListBlock({
  section,
  open,
  done,
  people,
  timeZone,
  isLead,
  progress,
  dragging,
  filtering,
  onError,
  actions,
}: {
  section: TodoSection
  open: Row[]
  done: Row[]
  progress: { done: number; total: number }
  people: Person[]
  timeZone: string
  isLead: boolean
  dragging: boolean
  filtering: boolean
  onError: (m: string) => void
  actions: {
    tick: (id: string, isDone: boolean) => void
    add: (sectionId: string, input: TodoInput) => Promise<string | undefined>
    edit: (id: string, input: TodoInput) => Promise<string | undefined>
    remove: (id: string) => void
  }
}) {
  const { setNodeRef, isOver } = useDroppable({ id: section.id })
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState(section.name)
  const [desc, setDesc] = useState(section.description ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const editRef = useRef<HTMLDetailsElement>(null)

  async function saveList(e: React.FormEvent) {
    e.preventDefault()
    const res = await editSection(section.id, name, desc)
    if (res?.error) return onError(res.error)
    if (editRef.current) editRef.current.open = false
  }

  return (
    <section className="space-y-1" aria-label={section.name}>
      <header className="flex items-start gap-3 pb-2">
        <Progress done={progress.done} total={progress.total} />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl leading-tight font-bold">{section.name}</h2>
          {section.description && <p className="text-sm text-grey">{section.description}</p>}
        </div>
        {isLead && (
          <details ref={editRef} className="relative shrink-0">
            <summary className="cursor-pointer list-none rounded-full px-3 py-1 text-sm font-bold text-grey hover:bg-sand">Edit list</summary>
            <form onSubmit={saveList} className="absolute right-0 z-10 mt-2 w-80 max-w-[80vw] space-y-3 rounded-[18px] border-2 border-beige bg-white p-4">
              <input aria-label="List name" className="field" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
              <input aria-label="List description" className="field" placeholder="Description (optional)" value={desc} maxLength={300} onChange={(e) => setDesc(e.target.value)} />
              <div className="flex items-center gap-2">
                <button className="chip chip-on">Save</button>
                {confirmDelete ? (
                  <button
                    type="button"
                    className="chip ml-auto"
                    onClick={async () => {
                      const res = await deleteSection(section.id)
                      if (res?.error) onError(res.error)
                    }}
                  >
                    Yes, delete it and its {open.length + done.length} to-do{open.length + done.length === 1 ? '' : 's'}
                  </button>
                ) : (
                  <button type="button" className="ml-auto text-sm font-bold text-grey underline" onClick={() => setConfirmDelete(true)}>
                    Delete list
                  </button>
                )}
              </div>
            </form>
          </details>
        )}
      </header>

      <SortableContext items={open.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          data-section={section.name}
          className={`min-h-6 rounded-lg border-t border-beige transition ${isOver && dragging ? 'bg-sand/60 outline-2 outline-dashed outline-beige' : ''}`}
        >
          {open.map((row) => (
            <SortableRow
              key={row.id}
              row={row}
              people={people}
              timeZone={timeZone}
              locked={filtering}
              onTick={() => actions.tick(row.id, true)}
              onSave={(i) => actions.edit(row.id, i)}
              onDelete={() => actions.remove(row.id)}
            />
          ))}
          {open.length === 0 && dragging && <p className="px-2 py-3 text-center text-sm text-grey">Drop it here</p>}
        </div>
      </SortableContext>

      <div className="py-2 pl-9">
        {adding ? (
          <TodoForm
            people={people}
            submitLabel="Add this to-do"
            onCancel={() => setAdding(false)}
            onSave={async (i) => {
              const msg = await actions.add(section.id, i)
              if (!msg) setAdding(false)
              return msg
            }}
          />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-2 text-sm font-bold text-blue underline">
            <span aria-hidden className="size-4 rounded-[4px] border-2 border-blue" />
            Add a to-do
          </button>
        )}
      </div>

      {done.length > 0 && (
        <details className="pl-9">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 text-sm text-grey">
            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
            {done.length} completed
          </summary>
          <ul className="mt-2">
            {done.map((row) => (
              <li key={row.id} className="flex items-center gap-2 border-b border-beige py-2">
                <input
                  type="checkbox"
                  aria-label={`Not done: ${row.title}`}
                  checked
                  onChange={() => actions.tick(row.id, false)}
                  className="size-5 shrink-0 accent-[#3750ab]"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-grey line-through">{row.title}</p>
                  {row.doneBy && row.doneAt && (
                    <p className="text-xs text-grey">
                      Ticked by {row.doneBy}, {agoLabel(row.doneAt)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// The page: toolbar + lists
// ---------------------------------------------------------------------------
export function TodoBoard({
  sections,
  items,
  people,
  timeZone,
  isLead,
}: {
  sections: TodoSection[]
  items: TodoItem[]
  people: Person[]
  timeZone: string
  isLead: boolean
}) {
  const [data, setData] = useState<Data>(() => build(sections, items))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const start = useRef<{ section: string; index: number } | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    try {
      if (localStorage.getItem('tribuo_todo_view') === 'grid') setView('grid')
    } catch {}
  }, [])
  const pickView = (v: 'list' | 'grid') => {
    setView(v)
    try {
      localStorage.setItem('tribuo_todo_view', v)
    } catch {}
  }

  // Pick up changes from the server (adding, ticking, other people's moves)
  useEffect(() => {
    if (!activeId) setData(build(sections, items))
  }, [sections, items, activeId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const findSection = (id: string, d: Data = dataRef.current) =>
    id in d.open ? id : Object.keys(d.open).find((k) => d.open[k].some((r) => r.id === id))

  const refresh = () => setData(build(sections, items))
  const fail = (m: string) => {
    setError(m)
    refresh()
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id)
    setActiveId(id)
    setError('')
    const sec = findSection(id)
    if (sec) start.current = { section: sec, index: dataRef.current.open[sec].findIndex((r) => r.id === id) }
  }

  // Moving over another list: slot the to-do in there right away
  function onDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over) return
    const activeKey = String(active.id)
    const overKey = String(over.id)
    const from = findSection(activeKey)
    const to = findSection(overKey)
    if (!from || !to || from === to) return
    setData((d) => {
      const fromItems = d.open[from]
      const toItems = d.open[to]
      const moving = fromItems.find((r) => r.id === activeKey)
      if (!moving) return d
      const overIndex = toItems.findIndex((r) => r.id === overKey)
      let at = toItems.length
      if (overIndex >= 0) {
        const translated = active.rect.current.translated
        const below = !!translated && !!over.rect && translated.top > over.rect.top + over.rect.height / 2
        at = overIndex + (below ? 1 : 0)
      }
      return {
        ...d,
        open: {
          ...d.open,
          [from]: fromItems.filter((r) => r.id !== activeKey),
          [to]: [...toItems.slice(0, at), moving, ...toItems.slice(at)],
        },
      }
    })
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    const activeKey = String(active.id)
    setActiveId(null)
    const begin = start.current
    start.current = null
    const sec = findSection(activeKey)
    if (!sec || !begin) return refresh()

    let index = dataRef.current.open[sec].findIndex((r) => r.id === activeKey)
    if (over) {
      const overKey = String(over.id)
      const overSec = findSection(overKey)
      if (overSec === sec) {
        const overIndex = overKey === sec ? dataRef.current.open[sec].length - 1 : dataRef.current.open[sec].findIndex((r) => r.id === overKey)
        if (overIndex >= 0 && overIndex !== index) {
          const moved = arrayMove(dataRef.current.open[sec], index, overIndex)
          setData((d) => ({ ...d, open: { ...d.open, [sec]: moved } }))
          index = overIndex
        }
      }
    }
    if (sec === begin.section && index === begin.index) return
    const res = await moveTodo(activeKey, sec, index)
    if (res?.error) fail(res.error)
  }

  const actions = {
    tick: async (id: string, isDone: boolean) => {
      setError('')
      // show it straight away; the server confirms a moment later
      setData((d) => {
        const sec = isDone ? findSection(id, d) : Object.keys(d.done).find((k) => d.done[k].some((r) => r.id === id))
        if (!sec) return d
        const row = (isDone ? d.open : d.done)[sec].find((r) => r.id === id)
        if (!row) return d
        return isDone
          ? { open: { ...d.open, [sec]: d.open[sec].filter((r) => r.id !== id) }, done: { ...d.done, [sec]: [{ ...row, doneBy: 'you', doneAt: new Date().toISOString() }, ...d.done[sec]] } }
          : { open: { ...d.open, [sec]: [...d.open[sec], row] }, done: { ...d.done, [sec]: d.done[sec].filter((r) => r.id !== id) } }
      })
      const res = await setTodoDone(id, isDone)
      if (res?.error) fail(res.error)
    },
    add: async (sectionId: string, input: TodoInput) => {
      setError('')
      const res = await addTodo(sectionId, input)
      return res?.error
    },
    edit: async (id: string, input: TodoInput) => {
      setError('')
      const res = await editTodo(id, input)
      if (res?.error) return res.error
      setData((d) => ({
        ...d,
        open: Object.fromEntries(
          Object.entries(d.open).map(([k, v]) => [
            k,
            v.map((r) =>
              r.id === id
                ? { ...r, title: input.title.trim(), notes: input.notes.trim() || null, assigneeId: input.assigneeId, dueOn: input.dueOn }
                : r,
            ),
          ]),
        ),
      }))
      return undefined
    },
    remove: async (id: string) => {
      setError('')
      setData((d) => ({
        open: Object.fromEntries(Object.entries(d.open).map(([k, v]) => [k, v.filter((r) => r.id !== id)])),
        done: d.done,
      }))
      const res = await deleteTodo(id)
      if (res?.error) fail(res.error)
    },
  }

  const activeRow = activeId
    ? Object.values(data.open)
        .flat()
        .find((r) => r.id === activeId)
    : null

  async function createList(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await addSection(newName, newDesc)
    if (res?.error) return setError(res.error)
    setNewName('')
    setNewDesc('')
    setNewOpen(false)
  }

  // Filter: match on title, notes or who it is for
  const q = filter.trim().toLowerCase()
  const nameOf = (id: string | null) => people.find((p) => p.id === id)?.full_name ?? ''
  const matches = (r: Row) => !q || `${r.title} ${r.notes ?? ''} ${nameOf(r.assigneeId)}`.toLowerCase().includes(q)
  const shown = sections
    .map((s) => ({
      s,
      open: (data.open[s.id] ?? []).filter(matches),
      done: (data.done[s.id] ?? []).filter(matches),
      all: (data.open[s.id]?.length ?? 0) + (data.done[s.id]?.length ?? 0),
      doneAll: data.done[s.id]?.length ?? 0,
    }))
    .filter((x) => !q || x.open.length + x.done.length > 0 || x.s.name.toLowerCase().includes(q))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {isLead && (
          <button type="button" className="chip chip-on" onClick={() => setNewOpen((v) => !v)} aria-expanded={newOpen}>
            + New list
          </button>
        )}
        <input
          aria-label="Filter to-dos"
          className="field min-w-0 flex-1 py-2.5 sm:max-w-xs"
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="ml-auto inline-flex overflow-hidden rounded-full border-2 border-beige" role="group" aria-label="View">
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === 'list'}
            onClick={() => pickView('list')}
            className={`px-3 py-2 ${view === 'list' ? 'bg-blue text-white' : 'bg-white text-grey'}`}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
            onClick={() => pickView('grid')}
            className={`px-3 py-2 ${view === 'grid' ? 'bg-blue text-white' : 'bg-white text-grey'}`}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></svg>
          </button>
        </div>
      </div>

      {isLead && newOpen && (
        <form onSubmit={createList} className="space-y-3 rounded-[18px] border-2 border-beige bg-white p-4">
          <input
            autoFocus
            aria-label="New list name"
            className="field"
            placeholder="Name this list (for example: Social media)"
            maxLength={60}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            aria-label="New list description"
            className="field"
            placeholder="Add a description (optional)"
            maxLength={300}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="chip chip-on" disabled={!newName.trim()}>
              Add this list
            </button>
            <button type="button" className="chip" onClick={() => setNewOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="rounded-xl border-2 border-beige bg-white px-4 py-3 text-sm font-bold text-danger">
          {error}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null)
          start.current = null
          refresh()
        }}
      >
        <div className={view === 'grid' ? 'grid items-start gap-x-8 gap-y-8 md:grid-cols-2' : 'space-y-8'}>
          {shown.map(({ s, open, done, all, doneAll }) => (
            <ListBlock
              key={s.id}
              section={s}
              open={open}
              done={done}
              progress={{ done: doneAll, total: all }}
              people={people}
              timeZone={timeZone}
              isLead={isLead}
              dragging={!!activeId}
              filtering={!!q}
              onError={setError}
              actions={actions}
            />
          ))}
        </div>
        {q && shown.length === 0 && <p className="text-center text-grey">Nothing matches “{filter.trim()}”.</p>}
        <DragOverlay>
          {activeRow ? (
            <div className="rounded-xl bg-white p-2 shadow-lg">
              <p className="px-3 py-2 font-bold">{activeRow.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
