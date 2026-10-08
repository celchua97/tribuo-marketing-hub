import { uploadConfig } from '@/lib/ideas'
import { SubmitForm } from '@/components/ideas/submit-form'

export default function SubmitPage() {
  return <SubmitForm uploads={uploadConfig()} />
}
