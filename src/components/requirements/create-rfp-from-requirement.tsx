'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { RfpFormDialog, type RfpFormDefaults } from '@/components/rfps/rfp-form-dialog'
import { Button } from '@/components/ui/button'
import { useCreateRfp } from '@/lib/queries/rfps'

type Props = { defaults: RfpFormDefaults; departments: string[]; currency: string }

// Decision P5-2: the PM turns a submitted requirement into an RFP (modal prefilled; the API
// links the two and moves the requirement to In Progress).
export function CreateRfpFromRequirement({ defaults, departments, currency }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const create = useCreateRfp()
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        Create RFP
      </Button>
      <RfpFormDialog
        open={open}
        onOpenChange={setOpen}
        mode="create"
        defaults={defaults}
        departments={departments}
        currency={currency}
        onSubmit={async (body) => {
          const { rfp } = await create.mutateAsync(body)
          setOpen(false)
          toast.success('RFP created successfully', { duration: 4000 })
          router.push(`/pipeline/rfp/${rfp.id}`)
        }}
      />
    </>
  )
}
