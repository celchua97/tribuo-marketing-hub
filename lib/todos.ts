import type { SupabaseClient } from '@supabase/supabase-js'

export type TodoSection = { id: string; name: string; description: string | null; sort_order: number }
export type TodoItem = {
  id: string
  section_id: string
  title: string
  position: number
  done: boolean
  done_at: string | null
  notes: string | null
  assignee_id: string | null
  due_on: string | null
  source_link: string | null
  created_by: string | null
  done_by_profile: { full_name: string } | null
}

export async function loadTodos(supabase: SupabaseClient) {
  const [sections, items] = await Promise.all([
    supabase.from('todo_sections').select('*').order('sort_order').returns<TodoSection[]>(),
    supabase
      .from('todo_items')
      .select('*, done_by_profile:profiles!todo_items_done_by_fkey(full_name)')
      .order('position')
      .returns<TodoItem[]>(),
  ])
  return { sections: sections.data ?? [], items: items.data ?? [] }
}
