'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import type { ActionState } from '@/app/(app)/actions'

export function ActionForm({
  action,
  children,
  className = 'space-y-3',
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  children: React.ReactNode
  className?: string
}) {
  const [state, formAction] = useActionState(action, undefined)
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
    </form>
  )
}

export function SubmitButton({
  children,
  pendingText = 'Saving…',
  className = 'btn-primary',
  disabled = false,
  name,
  value,
}: {
  children: React.ReactNode
  pendingText?: string
  className?: string
  disabled?: boolean
  name?: string
  value?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button className={className} disabled={pending || disabled} name={name} value={value}>
      {pending ? pendingText : children}
    </button>
  )
}
