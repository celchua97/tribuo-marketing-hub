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
  addTodos,
  deleteSection,
  deleteTodo,
  editTodo,
  moveTodo,
  renameSection,
  setTodoDone,
} from '@/app/(app)/todos/actions'
import { agoLabel } from '@/lib/dates'
import type { TodoItem, TodoSection } from '@/lib/todos'

type Row = { id: string; title: string; link: string | null; doneBy: string | null; doneAt: string | null }
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
  <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="currentColor">
    <circle cx="9" cy="6" r="1.6" />
    <circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" />
    <circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" />
    <circle cx="15" cy="18" r="1.6" />
  </svg>
)

// ---------------------------------------------------------------------------
// One to-do row
// ---------------------------------------------------------------------------
function RowBody({
  row,
  onTick,
  onEdit,
  onDelete,
  handle,
}: {
  row: Row
  onTick: () => void
  onEdit: (title: string) => void
  onDelete: () => void
  handle?: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(row.title)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => setText(row.title), [row.title])

  const save = () => {
    setEditing(false)
    const t = text.trim()
    if (t && t !== row.title) onEdit(t)
    else setText(row.title)
  }

  return (
    <div className="flex items-center gap-2 rounded-xl bg-canvas px-2 py-1.5">
      {handle}
      <input
        type="checkbox"
        aria-label={`Done: ${row.title}`}
        checked={false}
        onChange={onTick}
        className="size-7 shrink-0 accent-[#3750ab]"
      />
      {editing ? (
        <input
          autoFocus
          aria-label="Edit to-do"
          className="min-w-0 flex-1 rounded-lg bg-white px-2 py-2 outline-none"
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') {
              setText(row.title)
              setEditing(false)
            }
          }}
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="min-w-0 flex-1 py-2 text-left" title="Tap to edit">
          {row.title}
        </button>
      )}
      {row.link && !editing && (
        <a href={row.link} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-bold text-blue">
          Slides ↗
        </a>
      )}
      {confirm ? (
        <button
          type="button"
          onClick={onDelete}
          onBlur={() => setConfirm(false)}
          autoFocus
          className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white"
        >
          Delete?
        </button>
      ) : (
        <button
          type="button"
          aria-label={`Delete ${row.title}`}
          onClick={() => setConfirm(true)}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-lg text-grey hover:bg-white"
        >
          ×
        </button>
      )}
    </div>
  )
}

function SortableRow(props: Omit<Parameters<typeof RowBody>[0], 'handle'>) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.row.id,
  })
  return (
    <div
      ref={setNodeRef}
      data-todo={props.row.title}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
    >
      <RowBody
        {...props}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            aria-label={`Drag ${props.row.title}`}
            className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-grey hover:bg-white active:cursor-grabbing"
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
// Add a to-do
// ---------------------------------------------------------------------------
function AddTodo({ sectionId, onError }: { sectionId: string; onError: (m: string) => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    setBusy(true)
    const res = await addTodos(sectionId, [t])
    setBusy(false)
    if (res?.error) return onError(res.error)
    setText('')
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        aria-label="Add a to-do"
        className="field min-w-0 py-2.5"
        placeholder="Add a to-do"
        maxLength={200}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
      />
      <button className="chip shrink-0" disabled={busy || !text.trim()}>
        Add
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// A section: its open to-dos (a drop area) and its completed ones
// ---------------------------------------------------------------------------
function Section({
  section,
  open,
  done,
  isLead,
  dragging,
  onError,
  actions,
}: {
  section: TodoSection
  open: Row[]
  done: Row[]
  isLead: boolean
  dragging: boolean
  onError: (m: string) => void
  actions: {
    tick: (id: string, isDone: boolean) => void
    edit: (id: string, title: string) => void
    remove: (id: string) => void
  }
}) {
  const { setNodeRef, isOver } = useDroppable({ id: section.id })
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(section.name)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function rename(e: React.FormEvent) {
    e.preventDefault()
    const res = await renameSection(section.id, name)
    if (res?.error) return onError(res.error)
    setRenaming(false)
  }

  return (
    <section className="card space-y-4" aria-label={section.name}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="title text-2xl leading-tight">{section.name}</h2>
          <p className="label-caps mt-1 text-[11px] text-grey">
            {open.length} open{done.length > 0 ? ` · ${done.length} done` : ''}
          </p>
        </div>
        {isLead && (
          <details className="relative shrink-0">
            <summary className="chip min-h-10 cursor-pointer list-none text-xs">Edit section</summary>
            <div className="absolute right-0 z-10 mt-2 w-72 max-w-[80vw] space-y-3 rounded-[18px] border-2 border-beige bg-white p-4">
              <form onSubmit={rename} className="flex items-center gap-2">
                <input aria-label="Section name" className="field min-w-0 py-2" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
                <button className="chip shrink-0">Save</button>
              </form>
              {confirmDelete ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={async () => {
                    const res = await deleteSection(section.id)
                    if (res?.error) onError(res.error)
                  }}
                >
                  Yes, delete it and its {open.length + done.length} to-do{open.length + done.length === 1 ? '' : 's'}
                </button>
              ) : (
                <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(true)}>
                  Delete section
                </button>
              )}
            </div>
          </details>
        )}
      </header>

      <SortableContext items={open.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          data-section={section.name}
          className={`min-h-14 space-y-2 rounded-xl transition ${isOver && dragging ? 'bg-sand/60 outline-2 outline-dashed outline-beige' : ''}`}
        >
          {open.map((row) => (
            <SortableRow
              key={row.id}
              row={row}
              onTick={() => actions.tick(row.id, true)}
              onEdit={(t) => actions.edit(row.id, t)}
              onDelete={() => actions.remove(row.id)}
            />
          ))}
          {open.length === 0 && (
            <p className="rounded-xl border-2 border-dashed border-beige px-4 py-4 text-center text-sm text-grey">
              {dragging ? 'Drop it here' : 'Nothing here yet. Add a to-do below, or drag one in.'}
            </p>
          )}
        </div>
      </SortableContext>

      <AddTodo sectionId={section.id} onError={onError} />

      {done.length > 0 && (
        <details>
          <summary className="label-caps cursor-pointer text-xs text-grey">Completed ({done.length})</summary>
          <ul className="mt-3 space-y-2">
            {done.map((row) => (
              <li key={row.id} className="flex items-center gap-3 rounded-xl bg-canvas px-3 py-2">
                <input
                  type="checkbox"
                  aria-label={`Not done: ${row.title}`}
                  checked
                  onChange={() => actions.tick(row.id, false)}
                  className="size-7 shrink-0 accent-[#3750ab]"
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
// The board
// ---------------------------------------------------------------------------
export function TodoBoard({
  sections,
  items,
  isLead,
}: {
  sections: TodoSection[]
  items: TodoItem[]
  isLead: boolean
}) {
  const [data, setData] = useState<Data>(() => build(sections, items))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const start = useRef<{ section: string; index: number } | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data

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

  // Moving over another section: slot the card in there right away
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
    edit: async (id: string, title: string) => {
      setError('')
      const res = await editTodo(id, title)
      if (res?.error) fail(res.error)
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

  async function createSection(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await addSection(newName)
    if (res?.error) return setError(res.error)
    setNewName('')
  }

  return (
    <div className="space-y-4">
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
        {sections.map((s) => (
          <Section
            key={s.id}
            section={s}
            open={data.open[s.id] ?? []}
            done={data.done[s.id] ?? []}
            isLead={isLead}
            dragging={!!activeId}
            onError={setError}
            actions={actions}
          />
        ))}
        <DragOverlay>
          {activeRow ? (
            <div className="rounded-xl bg-white p-2 shadow-lg">
              <p className="px-3 py-2 font-bold">{activeRow.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {isLead && (
        <form onSubmit={createSection} className="card space-y-3">
          <h2 className="label-caps text-xs text-grey">Add a section</h2>
          <div className="flex items-center gap-2">
            <input
              aria-label="New section name"
              className="field min-w-0 py-2.5"
              placeholder="For example: Social media"
              maxLength={60}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button className="chip shrink-0" disabled={!newName.trim()}>
              Add section
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
