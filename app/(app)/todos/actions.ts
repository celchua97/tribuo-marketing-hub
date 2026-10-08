'use server'

import { revalidatePath } from 'next/cache'
import { requireLead, requireMe } from '@/lib/data'
import { friendlyError } from '@/lib/labels'

type Result = { error?: string } | undefined

function done(error?: { message: string } | null): Result {
  if (error) return { error: friendlyError(error.message) }
  revalidatePath('/todos')
  revalidatePath('/', 'layout')
  return undefined
}

// ---- Sections (Head of Marketing)
export async function addSection(name: string): Promise<Result & { id?: string }> {
  const { supabase, me } = await requireLead()
  const { data, error } = await supabase.rpc('todo_add_section', { p_actor: me.id, p_name: name })
  const r = done(error)
  return r ?? { id: data as string }
}

export async function renameSection(id: string, name: string): Promise<Result> {
  const { supabase, me } = await requireLead()
  const { error } = await supabase.rpc('todo_rename_section', { p_actor: me.id, p_id: id, p_name: name })
  return done(error)
}

export async function deleteSection(id: string): Promise<Result> {
  const { supabase, me } = await requireLead()
  const { error } = await supabase.rpc('todo_delete_section', { p_actor: me.id, p_id: id })
  return done(error)
}

// ---- To-dos (anyone on the team)
export async function addTodos(sectionId: string, titles: string[]): Promise<Result> {
  const { supabase, me } = await requireMe()
  const { error } = await supabase.rpc('todo_add_items', {
    p_actor: me.id,
    p_section: sectionId,
    p_titles: titles,
    p_link: null,
  })
  return done(error)
}

export async function setTodoDone(id: string, isDone: boolean): Promise<Result> {
  const { supabase, me } = await requireMe()
  const { error } = await supabase.rpc('todo_set_done', { p_actor: me.id, p_id: id, p_done: isDone })
  return done(error)
}

export async function editTodo(id: string, title: string): Promise<Result> {
  const { supabase, me } = await requireMe()
  const { error } = await supabase.rpc('todo_edit_item', { p_actor: me.id, p_id: id, p_title: title })
  return done(error)
}

export async function deleteTodo(id: string): Promise<Result> {
  const { supabase, me } = await requireMe()
  const { error } = await supabase.rpc('todo_delete_item', { p_actor: me.id, p_id: id })
  return done(error)
}

export async function moveTodo(id: string, sectionId: string, index: number): Promise<Result> {
  const { supabase, me } = await requireMe()
  const { error } = await supabase.rpc('todo_move_item', {
    p_actor: me.id,
    p_id: id,
    p_section: sectionId,
    p_index: index,
  })
  return done(error)
}

// ---- From the Slides import
export async function addTodosFromSlides(input: {
  sectionId: string | null
  newSection: string
  titles: string[]
  link: string
}): Promise<{ error?: string; added?: number; skipped?: number; sectionName?: string }> {
  const { supabase, me } = await requireLead()
  let sectionId = input.sectionId
  if (!sectionId || sectionId === '__new__') {
    const { data, error } = await supabase.rpc('todo_add_section', { p_actor: me.id, p_name: input.newSection })
    if (error) return { error: friendlyError(error.message) }
    sectionId = data as string
  }
  const { data, error } = await supabase.rpc('todo_add_items', {
    p_actor: me.id,
    p_section: sectionId,
    p_titles: input.titles.slice(0, 150),
    p_link: input.link.trim() || null,
  })
  if (error) return { error: friendlyError(error.message) }
  const { data: section } = await supabase.from('todo_sections').select('name').eq('id', sectionId).maybeSingle()
  revalidatePath('/todos')
  revalidatePath('/', 'layout')
  const r = data as { added: number; skipped: number }
  return { added: r.added, skipped: r.skipped, sectionName: section?.name }
}
